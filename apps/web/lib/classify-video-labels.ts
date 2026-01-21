/**
 * Video Label Classification Service
 *
 * Uses GPT-4o-mini to automatically classify videos based on their
 * transcription and AI summary. Suggests appropriate labels and
 * determines RAG eligibility.
 */

import { db } from "@cap/database";
import { nanoId } from "@cap/database/helpers";
import {
	videoLabelAssignments,
	videoLabels,
	videos,
} from "@cap/database/schema";
import type { VideoMetadata } from "@cap/database/types";
import { serverEnv } from "@cap/env";
import type { Video } from "@cap/web-domain";
import { and, eq } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

export interface LabelSuggestion {
	labelName: string;
	confidence: number; // 0.0 to 1.0
}

export interface ClassificationResult {
	success: boolean;
	labels: LabelSuggestion[];
	ragEligibility: "eligible" | "excluded" | "pending";
	reasoning: string;
	error?: string;
}

// =============================================================================
// SYSTEM LABELS DEFINITION
// =============================================================================

export const SYSTEM_LABELS = {
	// Content Type Labels (with retention)
	content_type: [
		{
			name: "TUTORIAL",
			displayName: "Tutorial",
			description: "Comment faire X dans un outil, guide pratique",
			color: "#10B981",
			retentionDays: null,
			ragDefault: "eligible" as const,
		},
		{
			name: "ONBOARDING",
			displayName: "Onboarding",
			description: "Formation nouveaux employés, présentation équipe",
			color: "#10B981",
			retentionDays: null,
			ragDefault: "eligible" as const,
		},
		{
			name: "PROCESS",
			displayName: "Process",
			description: "Explication d'un workflow interne, procédure",
			color: "#10B981",
			retentionDays: null,
			ragDefault: "eligible" as const,
		},
		{
			name: "DEMO",
			displayName: "Demo",
			description: "Démonstration produit/feature officielle",
			color: "#3B82F6",
			retentionDays: null,
			ragDefault: "eligible" as const,
		},
		{
			name: "TROUBLESHOOTING",
			displayName: "Troubleshooting",
			description: "Résolution de problème, debugging",
			color: "#F59E0B",
			retentionDays: 14,
			ragDefault: "pending" as const,
		},
		{
			name: "QUICK_ANSWER",
			displayName: "Quick Answer",
			description: "Réponse rapide à un collègue, explication ponctuelle",
			color: "#EF4444",
			retentionDays: 14,
			ragDefault: "excluded" as const,
		},
		{
			name: "MEETING_RECORDING",
			displayName: "Meeting Recording",
			description: "Enregistrement de réunion, call d'équipe",
			color: "#8B5CF6",
			retentionDays: 30,
			ragDefault: "pending" as const,
		},
		{
			name: "CLIENT_CALL",
			displayName: "Client Call",
			description: "Enregistrement appel client, demo client",
			color: "#EC4899",
			retentionDays: 30,
			ragDefault: "pending" as const,
		},
		{
			name: "ANNOUNCEMENT",
			displayName: "Announcement",
			description: "Communication interne, annonce",
			color: "#6366F1",
			retentionDays: 90,
			ragDefault: "pending" as const,
		},
	],

	// Department Labels
	department: [
		{ name: "SALES", displayName: "Sales", color: "#3B82F6" },
		{ name: "TECH", displayName: "Tech", color: "#10B981" },
		{ name: "PRODUCT", displayName: "Product", color: "#8B5CF6" },
		{ name: "COMPLIANCE", displayName: "Compliance", color: "#F59E0B" },
		{ name: "FINANCE", displayName: "Finance", color: "#6366F1" },
		{ name: "HR", displayName: "HR", color: "#EC4899" },
		{ name: "SUPPORT", displayName: "Support", color: "#14B8A6" },
		{ name: "MARKETING", displayName: "Marketing", color: "#F97316" },
	],
};

// =============================================================================
// CLASSIFICATION PROMPT (Machine-oriented)
// =============================================================================

const CLASSIFICATION_PROMPT = `TASK: Classify a video recording based on its transcription and AI summary.

INPUT FORMAT:
- VIDEO_TITLE: Title of the video
- VIDEO_DURATION: Duration in seconds
- TRANSCRIPTION: Full or partial transcription text
- AI_SUMMARY: AI-generated summary (if available)
- SHARED_IN_SPACES: List of folders/spaces where the video is shared

OUTPUT FORMAT (strict JSON):
{
  "content_type": {
    "primary": "LABEL_NAME",
    "confidence": 0.0-1.0,
    "secondary": "LABEL_NAME" | null
  },
  "department": {
    "label": "LABEL_NAME" | null,
    "confidence": 0.0-1.0
  },
  "rag_eligibility": "eligible" | "excluded" | "pending",
  "reasoning": "1-2 sentences explaining classification"
}

CONTENT TYPE LABELS:
- TUTORIAL: How-to guides, step-by-step instructions, tool explanations
- ONBOARDING: New employee training, team introductions, company orientation
- PROCESS: Internal workflows, procedures, standard operating procedures
- DEMO: Product demonstrations, feature showcases, official demos
- TROUBLESHOOTING: Problem solving, debugging, technical support (EPHEMERAL: 14 days)
- QUICK_ANSWER: Quick replies to colleagues, one-off explanations (EPHEMERAL: 14 days)
- MEETING_RECORDING: Team meetings, standups, planning sessions (EPHEMERAL: 30 days)
- CLIENT_CALL: Customer calls, client demos, sales calls (EPHEMERAL: 30 days)
- ANNOUNCEMENT: Internal communications, company updates (EPHEMERAL: 90 days)

DEPARTMENT LABELS:
SALES, TECH, PRODUCT, COMPLIANCE, FINANCE, HR, SUPPORT, MARKETING

RAG ELIGIBILITY RULES:
- "eligible": Durable knowledge content (tutorials, onboarding, demos, processes)
- "excluded": Ephemeral content (quick answers, troubleshooting for specific person)
- "pending": Uncertain - needs human review (meeting recordings, client calls)

CLASSIFICATION SIGNALS:
- Duration < 2 min + informal tone → likely QUICK_ANSWER
- Mentions "let me show you how" + step-by-step → TUTORIAL
- Multiple speakers + agenda mentions → MEETING_RECORDING
- Mentions client name + sales context → CLIENT_CALL
- Mentions "new joiners" or "welcome" → ONBOARDING
- Discusses specific bug/error + one person → TROUBLESHOOTING
- Official product walkthrough → DEMO

IMPORTANT:
- Return ONLY valid JSON, no markdown or explanation outside JSON
- confidence must be between 0.0 and 1.0
- If uncertain about department, set department.label to null
- Default to "pending" for rag_eligibility if unsure`;

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

export async function classifyVideoLabels(
	videoId: Video.VideoId,
	transcription: string,
	options?: {
		aiSummary?: string;
		title?: string;
		duration?: number;
		sharedSpaces?: string[];
	},
): Promise<ClassificationResult> {
	if (!serverEnv().OPENAI_API_KEY) {
		return {
			success: false,
			labels: [],
			ragEligibility: "pending",
			reasoning: "OpenAI API key not configured",
			error: "Missing OPENAI_API_KEY",
		};
	}

	// Prepare input for LLM
	const input = `VIDEO_TITLE: ${options?.title || "Untitled"}
VIDEO_DURATION: ${options?.duration || 0} seconds
TRANSCRIPTION:
${transcription.slice(0, 4000)}
${options?.aiSummary ? `\nAI_SUMMARY:\n${options.aiSummary}` : ""}
${options?.sharedSpaces?.length ? `\nSHARED_IN_SPACES: ${options.sharedSpaces.join(", ")}` : ""}`;

	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${serverEnv().OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{ role: "system", content: CLASSIFICATION_PROMPT },
					{ role: "user", content: input },
				],
				temperature: 0.1, // Low temperature for consistent classification
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
		}

		const json = await response.json();
		const content = json.choices?.[0]?.message?.content || "{}";

		// Parse response
		const parsed = parseClassificationResponse(content);

		// Update video with classification results
		await db()
			.update(videos)
			.set({
				aiSuggestedLabels: parsed.labels,
				aiClassifiedAt: new Date(),
				ragStatus: parsed.ragEligibility,
			})
			.where(eq(videos.id, videoId));

		return parsed;
	} catch (error) {
		console.error(`[classifyVideoLabels] Error for video ${videoId}:`, error);
		return {
			success: false,
			labels: [],
			ragEligibility: "pending",
			reasoning: "Classification failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function parseClassificationResponse(content: string): ClassificationResult {
	try {
		// Clean potential markdown formatting
		let cleaned = content;
		if (cleaned.includes("```json")) {
			cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
		} else if (cleaned.includes("```")) {
			cleaned = cleaned.replace(/```\s*/g, "");
		}

		const data = JSON.parse(cleaned.trim());

		const labels: LabelSuggestion[] = [];

		// Add primary content type
		if (data.content_type?.primary) {
			labels.push({
				labelName: data.content_type.primary,
				confidence: data.content_type.confidence || 0.8,
			});
		}

		// Add secondary content type if present
		if (data.content_type?.secondary) {
			labels.push({
				labelName: data.content_type.secondary,
				confidence: (data.content_type.confidence || 0.8) * 0.7,
			});
		}

		// Add department if identified
		if (data.department?.label) {
			labels.push({
				labelName: data.department.label,
				confidence: data.department.confidence || 0.7,
			});
		}

		return {
			success: true,
			labels,
			ragEligibility: data.rag_eligibility || "pending",
			reasoning: data.reasoning || "Classification complete",
		};
	} catch (error) {
		console.error("[parseClassificationResponse] Parse error:", error);
		return {
			success: false,
			labels: [],
			ragEligibility: "pending",
			reasoning: "Failed to parse classification response",
			error: "JSON parse error",
		};
	}
}

// =============================================================================
// AUTO-ASSIGN LABELS AFTER CLASSIFICATION
// =============================================================================

export async function autoAssignLabels(
	videoId: Video.VideoId,
	organizationId: string,
	classification: ClassificationResult,
	systemUserId: string,
): Promise<{ assigned: string[]; skipped: string[] }> {
	const assigned: string[] = [];
	const skipped: string[] = [];

	// Get organization's labels
	const orgLabels = await db()
		.select()
		.from(videoLabels)
		.where(
			and(
				eq(videoLabels.organizationId, organizationId as any),
				eq(videoLabels.isActive, true),
			),
		);

	const labelMap = new Map(orgLabels.map((l) => [l.name, l]));

	for (const suggestion of classification.labels) {
		// Only auto-assign if confidence >= 0.75
		if (suggestion.confidence < 0.75) {
			skipped.push(suggestion.labelName);
			continue;
		}

		const label = labelMap.get(suggestion.labelName);
		if (!label) {
			skipped.push(suggestion.labelName);
			continue;
		}

		// Check if already assigned
		const existing = await db()
			.select()
			.from(videoLabelAssignments)
			.where(
				and(
					eq(videoLabelAssignments.videoId, videoId),
					eq(videoLabelAssignments.labelId, label.id),
				),
			);

		if (existing.length > 0) {
			skipped.push(suggestion.labelName);
			continue;
		}

		// Assign label
		await db()
			.insert(videoLabelAssignments)
			.values({
				id: nanoId(),
				videoId,
				labelId: label.id,
				assignedById: systemUserId as any,
				isAiSuggested: true,
				aiConfidence: suggestion.confidence,
			});

		assigned.push(suggestion.labelName);
	}

	// Update video expiration based on assigned labels
	await updateVideoExpiration(videoId);

	return { assigned, skipped };
}

// =============================================================================
// EXPIRATION CALCULATION
// =============================================================================

export async function updateVideoExpiration(
	videoId: Video.VideoId,
): Promise<Date | null> {
	// Get video with its labels
	const video = await db()
		.select()
		.from(videos)
		.where(eq(videos.id, videoId))
		.limit(1);

	if (!video[0]) return null;

	// If keep permanently is set, no expiration
	if (video[0].keepPermanently) {
		await db()
			.update(videos)
			.set({ expiresAt: null })
			.where(eq(videos.id, videoId));
		return null;
	}

	// Get all assigned labels
	const assignments = await db()
		.select({ label: videoLabels })
		.from(videoLabelAssignments)
		.innerJoin(videoLabels, eq(videoLabelAssignments.labelId, videoLabels.id))
		.where(eq(videoLabelAssignments.videoId, videoId));

	// Find minimum retention
	const retentionDays = assignments
		.map((a) => a.label.retentionDays)
		.filter((d): d is number => d !== null);

	if (retentionDays.length === 0) {
		// All labels are permanent
		await db()
			.update(videos)
			.set({ expiresAt: null })
			.where(eq(videos.id, videoId));
		return null;
	}

	const minRetention = Math.min(...retentionDays);
	const expiresAt = new Date(video[0].createdAt);
	expiresAt.setDate(expiresAt.getDate() + minRetention);

	await db().update(videos).set({ expiresAt }).where(eq(videos.id, videoId));

	return expiresAt;
}

// =============================================================================
// SEED SYSTEM LABELS FOR ORGANIZATION
// =============================================================================

export async function seedSystemLabels(organizationId: string): Promise<void> {
	// Check if already seeded
	const existing = await db()
		.select()
		.from(videoLabels)
		.where(
			and(
				eq(videoLabels.organizationId, organizationId as any),
				eq(videoLabels.isSystem, true),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		console.log(
			`[seedSystemLabels] Labels already seeded for org ${organizationId}`,
		);
		return;
	}

	// Insert content type labels
	for (const label of SYSTEM_LABELS.content_type) {
		await db()
			.insert(videoLabels)
			.values({
				id: nanoId() as any,
				organizationId: organizationId as any,
				name: label.name,
				displayName: label.displayName,
				description: label.description,
				color: label.color,
				category: "content_type",
				retentionDays: label.retentionDays,
				ragDefault: label.ragDefault,
				isSystem: true,
				isActive: true,
			});
	}

	// Insert department labels
	for (const label of SYSTEM_LABELS.department) {
		await db()
			.insert(videoLabels)
			.values({
				id: nanoId() as any,
				organizationId: organizationId as any,
				name: label.name,
				displayName: label.displayName,
				description: null,
				color: label.color,
				category: "department",
				retentionDays: null,
				ragDefault: "pending",
				isSystem: true,
				isActive: true,
			});
	}

	console.log(
		`[seedSystemLabels] Seeded ${SYSTEM_LABELS.content_type.length + SYSTEM_LABELS.department.length} labels for org ${organizationId}`,
	);
}

// =============================================================================
// LABEL PROMOTION EVALUATION
// =============================================================================

/**
 * Prompt for evaluating if a user-created label should be promoted to system labels.
 * Machine-oriented prompt for GPT-4o-mini.
 */
const LABEL_EVALUATION_PROMPT = `TASK: Evaluate if a user-created video label should be added to the system's predefined label list.

EXISTING_SYSTEM_LABELS:
Content Types: TUTORIAL, ONBOARDING, PROCESS, DEMO, TROUBLESHOOTING, QUICK_ANSWER, MEETING_RECORDING, CLIENT_CALL, ANNOUNCEMENT
Departments: SALES, TECH, PRODUCT, COMPLIANCE, FINANCE, HR, SUPPORT, MARKETING

EVALUATION_CRITERIA:
1. RELEVANCE: Is this a meaningful category for classifying corporate video recordings?
2. UNIQUENESS: Is it semantically distinct from existing labels? (not a synonym, subset, or near-duplicate)
3. GENERALITY: Would this category apply across different organizations? (not company-specific)
4. CLARITY: Is the concept clear and unambiguous?

INPUT:
- LABEL_NAME: {{LABEL_NAME}}
- LABEL_DISPLAY_NAME: {{LABEL_DISPLAY_NAME}}
- LABEL_DESCRIPTION: {{LABEL_DESCRIPTION}}
- LABEL_CATEGORY: {{LABEL_CATEGORY}}

OUTPUT_FORMAT (JSON only, no markdown):
{
  "should_promote": boolean,
  "reason": "brief explanation (1 sentence)",
  "english_name": "UPPERCASE_SNAKE_CASE or null if rejected",
  "english_display_name": "Title Case or null if rejected",
  "english_description": "Brief description in English or null if rejected",
  "duplicate_of": "existing label name if duplicate/near-duplicate, null otherwise",
  "suggested_category": "content_type or department"
}

RULES:
- Return should_promote=false if label is a synonym of existing (e.g., "Formation" = TUTORIAL/ONBOARDING)
- Return should_promote=false if label is too specific (e.g., "JIRA_TUTORIAL" → use TUTORIAL)
- Return should_promote=false if label is company-specific (e.g., "WALLESTER_ONBOARDING")
- english_name must be UPPERCASE with underscores, max 30 chars
- Translate non-English labels to English
- Be strict: only promote truly novel, useful categories`;

export interface LabelEvaluationResult {
	shouldPromote: boolean;
	reason: string;
	englishName: string | null;
	englishDisplayName: string | null;
	englishDescription: string | null;
	duplicateOf: string | null;
	suggestedCategory: "content_type" | "department";
}

/**
 * Evaluates if a user-created label should be promoted to system labels.
 * Uses GPT-4o-mini for evaluation.
 */
export async function evaluateLabelForPromotion(
	labelName: string,
	labelDisplayName: string,
	labelDescription: string | null,
	labelCategory: "content_type" | "department",
): Promise<LabelEvaluationResult> {
	const env = serverEnv();

	if (!env.OPENAI_API_KEY) {
		console.warn("[evaluateLabelForPromotion] OPENAI_API_KEY not configured");
		return {
			shouldPromote: false,
			reason: "OpenAI API not configured",
			englishName: null,
			englishDisplayName: null,
			englishDescription: null,
			duplicateOf: null,
			suggestedCategory: labelCategory,
		};
	}

	const prompt = LABEL_EVALUATION_PROMPT.replace("{{LABEL_NAME}}", labelName)
		.replace("{{LABEL_DISPLAY_NAME}}", labelDisplayName)
		.replace(
			"{{LABEL_DESCRIPTION}}",
			labelDescription || "No description provided",
		)
		.replace("{{LABEL_CATEGORY}}", labelCategory);

	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content:
							"You are a label taxonomy expert. Output valid JSON only, no markdown.",
					},
					{ role: "user", content: prompt },
				],
				temperature: 0.1,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			console.error(
				"[evaluateLabelForPromotion] OpenAI API error:",
				response.status,
			);
			return {
				shouldPromote: false,
				reason: "API error",
				englishName: null,
				englishDisplayName: null,
				englishDescription: null,
				duplicateOf: null,
				suggestedCategory: labelCategory,
			};
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			return {
				shouldPromote: false,
				reason: "Empty response",
				englishName: null,
				englishDisplayName: null,
				englishDescription: null,
				duplicateOf: null,
				suggestedCategory: labelCategory,
			};
		}

		// Parse JSON response
		const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

		console.log(
			`[evaluateLabelForPromotion] Evaluated "${labelDisplayName}":`,
			{
				shouldPromote: parsed.should_promote,
				reason: parsed.reason,
				duplicateOf: parsed.duplicate_of,
			},
		);

		return {
			shouldPromote: parsed.should_promote === true,
			reason: parsed.reason || "No reason provided",
			englishName: parsed.english_name || null,
			englishDisplayName: parsed.english_display_name || null,
			englishDescription: parsed.english_description || null,
			duplicateOf: parsed.duplicate_of || null,
			suggestedCategory: parsed.suggested_category || labelCategory,
		};
	} catch (error) {
		console.error("[evaluateLabelForPromotion] Error:", error);
		return {
			shouldPromote: false,
			reason: "Evaluation failed",
			englishName: null,
			englishDisplayName: null,
			englishDescription: null,
			duplicateOf: null,
			suggestedCategory: labelCategory,
		};
	}
}

/**
 * Promotes a label to system labels across all organizations.
 * Called when a user-created label is evaluated as worthy of promotion.
 */
export async function promoteLabelToSystem(
	evaluation: LabelEvaluationResult,
	originalColor: string,
	retentionDays: number | null,
): Promise<{ promoted: boolean; reason: string }> {
	if (!evaluation.shouldPromote || !evaluation.englishName) {
		return { promoted: false, reason: evaluation.reason };
	}

	// Check if this label already exists as a system label (by name)
	const existingSystemLabel = await db()
		.select()
		.from(videoLabels)
		.where(
			and(
				eq(videoLabels.name, evaluation.englishName),
				eq(videoLabels.isSystem, true),
			),
		)
		.limit(1);

	if (existingSystemLabel.length > 0) {
		return {
			promoted: false,
			reason: `Label "${evaluation.englishName}" already exists as system label`,
		};
	}

	// Get all organizations that have system labels seeded
	const orgsWithLabels = await db()
		.selectDistinct({ organizationId: videoLabels.organizationId })
		.from(videoLabels)
		.where(eq(videoLabels.isSystem, true));

	// Add the new system label to all organizations
	for (const { organizationId } of orgsWithLabels) {
		// Check if org already has this label
		const existingForOrg = await db()
			.select()
			.from(videoLabels)
			.where(
				and(
					eq(videoLabels.organizationId, organizationId),
					eq(videoLabels.name, evaluation.englishName!),
				),
			)
			.limit(1);

		if (existingForOrg.length === 0) {
			await db()
				.insert(videoLabels)
				.values({
					id: nanoId() as any,
					organizationId,
					name: evaluation.englishName!,
					displayName: evaluation.englishDisplayName!,
					description: evaluation.englishDescription,
					color: originalColor,
					category: evaluation.suggestedCategory,
					retentionDays,
					ragDefault: "pending",
					isSystem: true,
					isActive: true,
				});
		}
	}

	console.log(
		`[promoteLabelToSystem] Promoted "${evaluation.englishName}" to ${orgsWithLabels.length} organizations`,
	);

	return {
		promoted: true,
		reason: `Label "${evaluation.englishDisplayName}" promoted to system labels`,
	};
}
