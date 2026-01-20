declare type MaybePromise<T> = T | Promise<T>;

declare type DistributiveOmit<T, K extends keyof any> = T extends any
	? Omit<T, K>
	: never;

// Next.js 15 Page Props helper type
// Extracts dynamic route params from a route string like "/s/[videoId]" -> { videoId: string }
type ExtractRouteParams<T extends string> =
	T extends `${infer _Start}[${infer Param}]${infer Rest}`
		? { [K in Param]: string } & ExtractRouteParams<Rest>
		: {};

declare type PageProps<Route extends string = string> = {
	params: Promise<ExtractRouteParams<Route>>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Next.js 15 Route Context for API routes
declare type RouteContext<Route extends string = string> = {
	params: Promise<ExtractRouteParams<Route>>;
};
