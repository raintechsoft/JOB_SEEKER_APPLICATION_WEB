/** Generated public contracts. G2 endpoints require the separately controlled Laravel public-browsing release gate. */
export interface paths {
    "/api/v1/public/feed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["publicBrowse_PublicFeedPage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/feed/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["publicBrowse_PublicFeedRefresh"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/feed/{entry}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["publicBrowse_PublicEntry"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/feed/{entry}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["publicBrowse_PublicCommentsPage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["publicBrowse_PublicSearchPage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        GuestAction: "browse" | "search" | "read_entry" | "read_comments" | "view_profile" | "view_job" | "view_portfolio" | "copy_link" | "native_share" | "like" | "comment" | "reply" | "repost" | "save_post" | "follow_person" | "follow_company" | "create_post" | "message" | "report" | "block" | "hide" | "share_followers" | "view_following" | "view_saved" | "view_messages" | "view_notifications" | "view_settings" | "save_job" | "apply" | "create_job_alert" | "view_applications" | "shortlist" | "compare_candidates" | "post_job" | "edit_post" | "delete_post" | "pin_comment" | "delete_comment" | "edit_job" | "change_application_status";
        PublicFeedQuery: {
            /**
             * @default all
             * @enum {string}
             */
            filter: "all" | "posts" | "jobs" | "updates";
            /**
             * @default recent
             * @constant
             */
            sort: "recent";
            /** @default 20 */
            limit: number;
            cursor?: string;
        };
        PublicCommentsQuery: {
            /** @default 20 */
            limit: number;
            cursor?: string;
            /** Format: uuid */
            focus?: string;
        };
        PublicSearchQuery: {
            q: string;
            /**
             * @default all
             * @enum {string}
             */
            scope: "all" | "posts" | "companies" | "people" | "jobs" | "updates";
            /**
             * @default relevance
             * @enum {string}
             */
            sort: "relevance" | "recent" | "salary_asc" | "salary_desc";
            /** @default 20 */
            limit: number;
            cursor?: string;
            selected?: string;
            location?: string;
            skill?: string;
            industry?: string;
            /** @enum {string} */
            companyType?: "Privately held" | "Public company" | "Nonprofit" | "Government" | "Partnership" | "Self-employed" | "Other";
            /** @enum {string} */
            arrangement?: "On-site" | "Hybrid" | "Remote";
            /** @enum {string} */
            employment?: "Full-time" | "Part-time" | "Contract" | "Internship" | "Apprenticeship" | "Consultancy" | "Deputation" | "Empanelment";
            /** @enum {string} */
            education?: "Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification";
            /** @enum {string} */
            contentType?: "text" | "image" | "video" | "project";
            /** Format: uuid */
            author?: string;
            days?: number;
            experienceMin?: number;
            experienceMax?: number;
            salaryMin?: number;
            salaryMax?: number;
            /** @enum {string} */
            currency?: "INR" | "USD" | "EUR" | "GBP";
            /** @enum {string} */
            compensationPeriod?: "hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement";
        };
        PublicMedia: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "image" | "video" | "document";
            mime: string;
            name: string;
            alt: string;
            downloadPath: string;
            position?: number;
        };
        PublicExternalVideo: {
            position: number;
            url: string;
            name: string;
            alt: string;
        };
        PublicAuthor: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "professional" | "recruiter";
            name: string;
            headline: string;
            profilePath: string;
            picture: components["schemas"]["PublicMedia"] | null;
        };
        PublicCompany: {
            id: string | null;
            name: string;
            profilePath: string | null;
            confidential: boolean;
            logo: components["schemas"]["PublicMedia"] | null;
            verified: boolean;
        } & unknown;
        PublicJobSummary: {
            /** Format: uuid */
            id: string;
            title: string;
            location: string;
            arrangement: string;
            employment: string;
            compensationLabel: string;
            acceptingApplications: boolean;
            closesAt: string | null;
            publicPath: string;
        };
        PublicEntry: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "post" | "job" | "update";
            path: string;
            title: string;
            body: string;
            /** Format: date-time */
            publishedAt: string;
            author: components["schemas"]["PublicAuthor"] | null;
            company: components["schemas"]["PublicCompany"] | null;
            media: components["schemas"]["PublicMedia"][];
            counts: {
                likes: number;
                comments: number;
                reposts: number;
            };
            job: components["schemas"]["PublicJobSummary"] | null;
            externalVideos?: components["schemas"]["PublicExternalVideo"][];
        } & unknown;
        PublicComment: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            entryId: string;
            parentId: string | null;
            author: components["schemas"]["PublicAuthor"];
            text: string;
            /** Format: date-time */
            createdAt: string;
            pinned: boolean;
        };
        PublicSearchResult: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "person" | "company" | "post" | "job" | "update";
            title: string;
            subtitle: string;
            path: string;
            picture: components["schemas"]["PublicMedia"] | null;
        };
        PublicBrowseError: {
            /** @enum {string} */
            code: "not_found" | "validation_failed" | "rate_limited" | "request_failed" | "forbidden";
            message: string;
            errors?: {
                [key: string]: string[];
            } | unknown[];
            /** Format: uuid */
            request_id?: string;
        };
        PublicFeedPage: {
            items: components["schemas"]["PublicEntry"][];
            nextCursor: string | null;
            total: number;
        };
        PublicFeedRefreshQuery: {
            /** @description One to forty unique, comma-separated lowercase UUIDs. Inaccessible entries are omitted. */
            ids: string;
            /**
             * @default all
             * @enum {string}
             */
            filter: "all" | "posts" | "jobs" | "updates";
        };
        PublicFeedRefresh: components["schemas"]["PublicEntry"][];
        PublicCommentsPage: {
            items: components["schemas"]["PublicComment"][];
            nextCursor: string | null;
            total: number;
        };
        PublicSearchPage: {
            items: components["schemas"]["PublicSearchResult"][];
            nextCursor: string | null;
            total: number;
            /** @enum {string} */
            scope: "all" | "posts" | "companies" | "people" | "jobs" | "updates";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    publicBrowse_PublicFeedPage: {
        parameters: {
            query?: {
                filter?: "all" | "posts" | "jobs" | "updates";
                sort?: "recent";
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Whitelisted public projection; no viewer identity or private account data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PublicFeedPage"];
                    };
                };
            };
            /** @description Untrusted application origin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Absent or ineligible content; do not reveal private resource existence */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Unsupported or invalid query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public read limit exceeded */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public browsing is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
        };
    };
    publicBrowse_PublicFeedRefresh: {
        parameters: {
            query: {
                ids: string;
                filter?: "all" | "posts" | "jobs" | "updates";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Whitelisted public projection; no viewer identity or private account data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PublicFeedRefresh"];
                    };
                };
            };
            /** @description Untrusted application origin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Absent or ineligible content; do not reveal private resource existence */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Unsupported or invalid query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public read limit exceeded */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public browsing is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
        };
    };
    publicBrowse_PublicEntry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entry: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Whitelisted public projection; no viewer identity or private account data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PublicEntry"];
                    };
                };
            };
            /** @description Untrusted application origin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Absent or ineligible content; do not reveal private resource existence */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Unsupported or invalid query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public read limit exceeded */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public browsing is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
        };
    };
    publicBrowse_PublicCommentsPage: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
                focus?: string;
            };
            header?: never;
            path: {
                entry: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Whitelisted public projection; no viewer identity or private account data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PublicCommentsPage"];
                    };
                };
            };
            /** @description Untrusted application origin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Absent or ineligible content; do not reveal private resource existence */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Unsupported or invalid query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public read limit exceeded */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public browsing is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
        };
    };
    publicBrowse_PublicSearchPage: {
        parameters: {
            query: {
                q: string;
                scope?: "all" | "posts" | "companies" | "people" | "jobs" | "updates";
                sort?: "relevance" | "recent" | "salary_asc" | "salary_desc";
                limit?: number;
                cursor?: string;
                selected?: string;
                location?: string;
                skill?: string;
                industry?: string;
                companyType?: "Privately held" | "Public company" | "Nonprofit" | "Government" | "Partnership" | "Self-employed" | "Other";
                arrangement?: "On-site" | "Hybrid" | "Remote";
                employment?: "Full-time" | "Part-time" | "Contract" | "Internship" | "Apprenticeship" | "Consultancy" | "Deputation" | "Empanelment";
                education?: "Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification";
                contentType?: "text" | "image" | "video" | "project";
                author?: string;
                days?: number;
                experienceMin?: number;
                experienceMax?: number;
                salaryMin?: number;
                salaryMax?: number;
                currency?: "INR" | "USD" | "EUR" | "GBP";
                compensationPeriod?: "hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Whitelisted public projection; no viewer identity or private account data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PublicSearchPage"];
                    };
                };
            };
            /** @description Untrusted application origin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Absent or ineligible content; do not reveal private resource existence */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Unsupported or invalid query */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public read limit exceeded */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
            /** @description Public browsing is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBrowseError"];
                };
            };
        };
    };
}
