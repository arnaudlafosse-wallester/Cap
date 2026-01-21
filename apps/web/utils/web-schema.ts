export const createOrganizationSchema = () => ({
	"@context": "https://schema.org",
	"@type": "Organization",
	"@id": "https://wallester-record.com/#organization",
	name: "Wallester Record",
	url: "https://wallester-record.com",
	logo: {
		"@type": "ImageObject",
		url: "https://cdn.brandfetch.io/idid01rD7k/w/400/h/400/theme/dark/icon.png",
		width: 400,
		height: 400,
	},
	description:
		"Wallester Record is the internal screen recording tool for Wallester. Lightweight, powerful, and cross-platform screen recorder.",
	sameAs: [],
	contactPoint: {
		"@type": "ContactPoint",
		email: "support@wallester.com",
		contactType: "customer service",
	},
});

export const createWebSiteSchema = () => ({
	"@context": "https://schema.org",
	"@type": "WebSite",
	"@id": "https://wallester-record.com/#website",
	url: "https://wallester-record.com",
	name: "Wallester Record",
	description: "Beautiful screen recordings for Wallester internal use.",
	publisher: {
		"@id": "https://wallester-record.com/#organization",
	},
});

import type { Testimonial } from "@/data/testimonials";
import { testimonials as allTestimonials } from "@/data/testimonials";

export const createSoftwareApplicationSchema = (
	testimonials?: readonly Testimonial[],
) => {
	const testimonialsToUse = testimonials || allTestimonials;

	const rogerTestimonial = allTestimonials.find(
		(t) => t.handle === "@_rogermattos",
	);
	const selectedTestimonials = rogerTestimonial
		? [
				rogerTestimonial,
				...testimonialsToUse
					.filter((t) => t.handle !== "@_rogermattos")
					.slice(0, 4),
			]
		: testimonialsToUse.slice(0, 5);

	const reviews = selectedTestimonials.map((testimonial) => ({
		"@type": "Review",
		reviewRating: {
			"@type": "Rating",
			ratingValue: "5",
		},
		author: {
			"@type": "Person",
			name: testimonial.name,
			...(testimonial.handle && { alternateName: testimonial.handle }),
		},
		reviewBody: testimonial.content,
		url: testimonial.url,
	}));

	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"@id": "https://cap.so/#software",
		name: "Cap",
		applicationCategory: "MultimediaApplication",
		operatingSystem: ["macOS", "Windows"],
		description:
			"Cap is a powerful, open-source screen recording software that offers instant sharing, studio mode, and privacy-focused features.",
		url: "https://cap.so",
		downloadUrl: "https://cap.so/download",
		screenshot: [
			{
				"@type": "ImageObject",
				url: "https://cap.so/og.png",
				caption: "Cap screen recorder interface",
			},
		],
		featureList: [
			"Screen recording up to 4K resolution",
			"60fps recording",
			"Instant sharing with links",
			"Studio mode for professional editing",
			"Built-in thread commenting",
			"Custom domain support",
			"Own S3 storage integration",
			"Cross-platform (Mac & Windows)",
			"Open source",
			"Privacy-focused",
		],
		offers: [
			{
				"@type": "Offer",
				price: "0",
				priceCurrency: "USD",
				name: "Free Plan",
				description: "Studio mode for personal use, 5-minute shareable links",
			},
			{
				"@type": "Offer",
				price: "8.16",
				priceCurrency: "USD",
				name: "Pro Plan",
				priceValidUntil: "2025-12-31",
				description: "Full features for professional use",
				eligibleQuantity: {
					"@type": "QuantitativeValue",
					unitText: "month",
				},
			},
		],
		aggregateRating: {
			"@type": "AggregateRating",
			ratingValue: "4.8",
			reviewCount: allTestimonials.length.toString(),
			bestRating: "5",
			worstRating: "1",
		},
		review: reviews,
		creator: {
			"@id": "https://cap.so/#organization",
		},
	};
};

export const createBreadcrumbSchema = (
	items: Array<{ name: string; url?: string }>,
) => ({
	"@context": "https://schema.org",
	"@type": "BreadcrumbList",
	itemListElement: items.map((item, index) => ({
		"@type": "ListItem",
		position: index + 1,
		name: item.name,
		...(item.url && { item: item.url }),
	})),
});

export const createVideoObjectSchema = (video: {
	name: string;
	description: string;
	thumbnailUrl: string;
	uploadDate?: string;
	duration?: string;
	embedUrl?: string;
}) => ({
	"@context": "https://schema.org",
	"@type": "VideoObject",
	name: video.name,
	description: video.description,
	thumbnailUrl: video.thumbnailUrl,
	uploadDate: video.uploadDate || new Date().toISOString(),
	duration: video.duration || "PT2M",
	embedUrl: video.embedUrl,
	publisher: {
		"@id": "https://cap.so/#organization",
	},
});

export const createFAQSchema = (
	faqs: Array<{ question: string; answer: string }>,
) => ({
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: faqs.map((faq) => ({
		"@type": "Question",
		name: faq.question,
		acceptedAnswer: {
			"@type": "Answer",
			text: faq.answer.replace(/<\/?[^>]+(>|$)/g, ""),
		},
	})),
});

export const createProductSchema = () => ({
	"@context": "https://schema.org",
	"@type": "Product",
	name: "Cap Screen Recorder",
	description:
		"Open-source screen recording software with instant sharing and studio mode capabilities",
	brand: {
		"@type": "Brand",
		name: "Cap",
	},
	offers: {
		"@type": "AggregateOffer",
		priceCurrency: "USD",
		lowPrice: "0",
		highPrice: "8.16",
		offerCount: "2",
	},
	aggregateRating: {
		"@type": "AggregateRating",
		ratingValue: "4.8",
		reviewCount: "250",
	},
});

export const createComparisonTableSchema = () => ({
	"@context": "https://schema.org",
	"@type": "Table",
	about: "Feature comparison between Cap and Loom screen recorders",
	mainEntity: {
		"@type": "ItemList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: "Open Source",
				item: {
					"@type": "PropertyValue",
					name: "Cap",
					value: "Yes",
				},
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Pricing",
				item: {
					"@type": "PropertyValue",
					name: "Cap",
					value: "$8.16/month per user",
				},
			},
			{
				"@type": "ListItem",
				position: 3,
				name: "4K Recording",
				item: {
					"@type": "PropertyValue",
					name: "Cap",
					value: "Available in free & paid plans",
				},
			},
		],
	},
});

export const createLocalBusinessSchema = () => ({
	"@context": "https://schema.org",
	"@type": "LocalBusiness",
	name: "Cap",
	image: "https://cap.so/og.png",
	"@id": "https://cap.so",
	url: "https://cap.so",
	priceRange: "$0-$8.16",
	address: {
		"@type": "PostalAddress",
		addressCountry: "US",
	},
});
