/** Generated application contracts. A2–A6 application drafts, verification, documents, review and submission implemented; live entry separately gated. */
export interface paths {
    "/api/v1/jobs/{job}/application-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_jobs__job__application_context"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job}/application-drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["applicationWizard_post__api_v1_jobs__job__application_drafts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_application_drafts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_application_drafts__draft_"];
        put?: never;
        post?: never;
        delete: operations["applicationWizard_delete__api_v1_me_application_drafts__draft_"];
        options?: never;
        head?: never;
        patch: operations["applicationWizard_patch__api_v1_me_application_drafts__draft_"];
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}/contact-challenges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["applicationWizard_post__api_v1_me_application_drafts__draft__contact_challenges"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}/contact-challenges/{challenge}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_application_drafts__draft__contact_challenges__challenge_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}/contact-challenges/{challenge}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["applicationWizard_post__api_v1_me_application_drafts__draft__contact_challenges__challenge__verify"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job}/applications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["applicationWizard_post__api_v1_jobs__job__applications"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_application_drafts__draft__documents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/resume-library/{asset}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["applicationWizard_delete__api_v1_me_resume_library__asset_"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/application-drafts/{draft}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_application_drafts__draft__review"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/applications/{application}/receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_applications__application__receipt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/applications/{application}/attachments/{attachment}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_me_applications__application__attachments__attachment__download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/responses/{application}/attachments/{attachment}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["applicationWizard_get__api_v1_organizations__organization__hiring_responses__application__attachments__attachment__download"];
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
        ApplicationStep: "contact" | "documents" | "details" | "questions" | "review";
        ApplicationPhone: {
            country: string;
            nationalNumber: string;
        };
        ApplicationExpectedPay: {
            currency: ("INR" | "USD" | "EUR" | "GBP") | null;
            period: ("hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement") | null;
            amount: string | null;
        };
        ApplicationContactValues: {
            name: string;
            email: string | "";
            phone: components["schemas"]["ApplicationPhone"] | null;
        };
        ApplicationDocuments: {
            resumeAssetId: string | null;
            includePortfolio: boolean;
        };
        ApplicationDetails: {
            introduction: string;
            location: string;
            locality: string;
            noticeDays: number | null;
            joiningDays: number | null;
            industry: string;
            designation: string;
            department: string;
            preferredLocations: string[];
            expectedCompensation: components["schemas"]["ApplicationExpectedPay"] | null;
        };
        ApplicationAnswers: {
            [key: string]: string;
        };
        ApplicationQuestion: {
            /** Format: uuid */
            id: string;
            text: string;
            /** @enum {string} */
            type: "text" | "number" | "yesno";
            required: boolean;
        };
        ApplicationRequirements: {
            version: number;
            questionsVersion: number;
            jobVersion: number;
            requireResume: boolean;
            requirePhone: boolean;
            requirePortfolio: boolean;
            questions: components["schemas"]["ApplicationQuestion"][];
        };
        ApplicationDraftCreate: {
            /** @constant */
            schemaVersion: 2;
            /** Format: uuid */
            creationKey: string;
        };
        ApplicationDraftDiscard: {
            /** @constant */
            schemaVersion: 2;
            version: number;
        };
        ApplicationContactChallenge: {
            /** @constant */
            schemaVersion: 2;
            /** @constant */
            kind: "email";
            /** Format: email */
            email: string;
        } | {
            /** @constant */
            schemaVersion: 2;
            /** @constant */
            kind: "phone";
            phone: components["schemas"]["ApplicationPhone"];
        };
        ApplicationContactVerify: {
            /** @constant */
            schemaVersion: 2;
            code: string;
        };
        ApplicationSubmit: {
            /** @constant */
            schemaVersion: 2;
            /** Format: uuid */
            draftId: string;
            version: number;
            requirementsVersion: number;
            questionsVersion: number;
            jobVersion: number;
            /** Format: uuid */
            idempotencyKey: string;
            /** @constant */
            acknowledgementVersion: "application-review-2";
            /** @constant */
            sharingAcknowledged: true;
            /** @description Server-computed fingerprint of the exact current draft/job/contact/document/profile/portfolio projection; compare again under locks, never an authorization or contact proof. */
            reviewHash: string;
        };
        ApplicationProofStatus: {
            email: {
                value: string | "";
                verified: boolean;
            };
            phone: {
                e164: string;
                verified: boolean;
            } | null;
        };
        ApplicationResume: {
            /** Format: uuid */
            id: string;
            name: string;
            mime: string;
            bytes: number;
            /** @enum {string} */
            state: "pending" | "uploaded" | "accepted" | "rejected";
        };
        ApplicationAttachment: {
            /** Format: uuid */
            id: string;
            name: string;
            mime: string;
            bytes: number;
            /** @constant */
            kind: "resume";
        };
        ApplicationChallengeStatus: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "email" | "phone";
            maskedDestination: string;
            /** @enum {string} */
            status: "pending" | "verified" | "expired" | "unavailable";
            /** Format: date-time */
            sentAt: string;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            resendAt: string;
            /** Format: date-time */
            serverTime: string;
        };
        ApplicationError: {
            /** @enum {string} */
            code: "unauthenticated" | "forbidden" | "not_found" | "session_expired" | "request_failed" | "validation_failed" | "application_draft_conflict" | "application_requirements_changed" | "job_closed" | "application_already_submitted" | "application_contact_unverified" | "application_challenge_expired" | "application_upload_pending" | "application_upload_rejected" | "application_client_upgrade_required" | "application_delivery_unavailable" | "rate_limited" | "application_draft_expired" | "application_contact_changed";
            message: string;
            errors: {
                [key: string]: string[];
            };
            /** Format: uuid */
            request_id: string;
        };
        ApplicationValues: {
            contact: components["schemas"]["ApplicationContactValues"];
            documents: components["schemas"]["ApplicationDocuments"];
            details: components["schemas"]["ApplicationDetails"];
            answers: components["schemas"]["ApplicationAnswers"];
        };
        ApplicationDraftSave: {
            /** @constant */
            schemaVersion: 2;
            version: number;
            requirementsVersion: number;
            questionsVersion: number;
            jobVersion: number;
            step: components["schemas"]["ApplicationStep"];
            /** @enum {string} */
            intent: "save" | "advance";
            values: components["schemas"]["ApplicationValues"];
        };
        ApplicationDraft: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            jobId: string;
            version: number;
            requirementsVersion: number;
            questionsVersion: number;
            jobVersion: number;
            step: components["schemas"]["ApplicationStep"];
            reachedStep: components["schemas"]["ApplicationStep"];
            /** @enum {string} */
            state: "active" | "submitted" | "discarded" | "expired";
            values: components["schemas"]["ApplicationValues"];
            /** Format: date-time */
            savedAt: string;
            /** Format: date-time */
            expiresAt: string;
            submittedApplicationId: string | null;
        };
        ApplicationWorkPreview: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "project" | "work_sample" | "work_update";
            title: string;
            description: string;
            url: string | null;
        };
        ApplicationReviewProfile: {
            id: string;
            slug: string;
            name: string;
            headline: string;
            /** @enum {unknown} */
            category: "Design" | "Engineering" | "Data" | "Business";
            location: string;
            summary: string;
            experience: string;
            education: string;
            arrangement: string;
            website: string;
            picture: string;
            color: string;
            lastActive: string;
            years: number;
            skills: string[];
            available: boolean;
            public: boolean;
            complete: number;
            /** @constant */
            interests: "";
            credentials: {
                groups: {
                    label: string;
                    records: {
                        title: string;
                        source?: string;
                        description?: string;
                        url?: string;
                        linkLabel?: string;
                    }[];
                }[];
                breaks: {
                    start: string;
                    end: string;
                    current: boolean;
                    description: string;
                }[];
                contact: {
                    email?: string;
                    phone?: string;
                };
            };
        };
        ApplicationReview: {
            /** Format: uuid */
            draftId: string;
            version: number;
            requirementsVersion: number;
            questionsVersion: number;
            jobVersion: number;
            reviewHash: string;
            values: components["schemas"]["ApplicationValues"];
            questions: components["schemas"]["ApplicationQuestion"][];
            contactStatus: components["schemas"]["ApplicationProofStatus"];
            resume: components["schemas"]["ApplicationResume"] | null;
            profile: components["schemas"]["ApplicationReviewProfile"];
            portfolio: {
                title: string;
                items: components["schemas"]["ApplicationWorkPreview"][];
            } | null;
        };
        ApplicationReceipt: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            jobId: string;
            schemaVersion: number;
            /** Format: date-time */
            submittedAt: string;
            attachments: components["schemas"]["ApplicationAttachment"][];
            /** @enum {string} */
            contactVerification: "recorded" | "not_recorded";
        };
        ApplicationSharing: {
            /** @constant */
            schemaVersion: 2;
            expectedCompensation: {
                currency: ("INR" | "USD" | "EUR" | "GBP") | null;
                period: ("hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement") | null;
                amount: string | null;
            } | null;
            verification: {
                email: {
                    /** Format: date-time */
                    verifiedAt: string;
                    /** @enum {string} */
                    source: "account" | "application";
                } | null;
                phone: {
                    /** Format: date-time */
                    verifiedAt: string;
                    /** @enum {string} */
                    source: "account" | "application";
                } | null;
            };
            attachments: {
                /** Format: uuid */
                id: string;
                name: string;
                mime: string;
                bytes: number;
                /** @constant */
                kind: "resume";
            }[];
            portfolio: {
                title: string;
                items: {
                    /** Format: uuid */
                    id: string;
                    /** @enum {string} */
                    kind: "project" | "work_sample" | "work_update";
                    title: string;
                    description: string;
                    url: string | null;
                }[];
            } | null;
        };
        ApplicationDocumentContext: {
            /** Format: uuid */
            draftId: string;
            version: number;
            requirements: {
                requireResume: boolean;
                requirePortfolio: boolean;
            };
            resume: components["schemas"]["ApplicationResume"] | null;
            savedResume: components["schemas"]["ApplicationResume"] | null;
            library: components["schemas"]["ApplicationResume"][];
            resumeIssue: string | null;
            includePortfolio: boolean;
            portfolio: {
                title: string;
                ready: boolean;
                sections: string[];
                items: components["schemas"]["ApplicationWorkPreview"][];
                totalItems: number;
            };
        };
        ApplicationContext: {
            /** Format: uuid */
            jobId: string;
            title: string;
            companyName: string;
            acceptingApplications: boolean;
            closesAt: string | null;
            requirements: components["schemas"]["ApplicationRequirements"];
            draft: components["schemas"]["ApplicationDraft"] | null;
            application: components["schemas"]["ApplicationReceipt"] | null;
            contactStatus: components["schemas"]["ApplicationProofStatus"];
            profilePhone: components["schemas"]["ApplicationPhone"] | null;
            resume: components["schemas"]["ApplicationResume"] | null;
            portfolioReady: boolean;
            locations: string[];
        };
        ApplicationDraftSummary: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            jobId: string;
            title: string;
            companyName: string;
            step: components["schemas"]["ApplicationStep"];
            /** @enum {string} */
            state: "active" | "submitted" | "discarded" | "expired";
            version: number;
            /** Format: date-time */
            savedAt: string;
            /** Format: date-time */
            expiresAt: string;
        };
        ApplicationDraftPage: {
            items: components["schemas"]["ApplicationDraftSummary"][];
            total: number;
            page: number;
            pageSize: number;
        };
        ResumeLibraryRemoval: {
            deleted: boolean;
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
    applicationWizard_get__api_v1_jobs__job__application_context: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationContext"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_post__api_v1_jobs__job__application_drafts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationDraftCreate"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationDraft"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_application_drafts: {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationDraftPage"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_application_drafts__draft_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationDraft"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_delete__api_v1_me_application_drafts__draft_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationDraftDiscard"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_patch__api_v1_me_application_drafts__draft_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationDraftSave"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationDraft"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_post__api_v1_me_application_drafts__draft__contact_challenges: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationContactChallenge"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationChallengeStatus"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_application_drafts__draft__contact_challenges__challenge_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
                challenge: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationChallengeStatus"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_post__api_v1_me_application_drafts__draft__contact_challenges__challenge__verify: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
                challenge: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationContactVerify"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationProofStatus"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_post__api_v1_jobs__job__applications: {
        parameters: {
            query?: never;
            header: {
                "X-Skillora-Application-Schema": 2;
            };
            path: {
                job: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationSubmit"];
            };
        };
        responses: {
            /** @description Owned private draft or application-contact result */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationReceipt"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_application_drafts__draft__documents: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationDocumentContext"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_delete__api_v1_me_resume_library__asset_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                asset: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ResumeLibraryRemoval"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_application_drafts__draft__review: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationReview"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_applications__application__receipt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                application: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owned private draft or application-contact result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ApplicationReceipt"];
                    };
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_me_applications__application__attachments__attachment__download: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                application: string;
                attachment: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authorized private streamed file; persistent storage keys are not serialized */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            /** @description Optional short-lived authorized download redirect after current access checks */
            302: {
                headers: {
                    Location: string;
                    "Cache-Control"?: "private, no-store";
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
    applicationWizard_get__api_v1_organizations__organization__hiring_responses__application__attachments__attachment__download: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                application: string;
                attachment: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authorized private streamed file; persistent storage keys are not serialized */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            /** @description Optional short-lived authorized download redirect after current access checks */
            302: {
                headers: {
                    Location: string;
                    "Cache-Control"?: "private, no-store";
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            412: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            419: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
            /** @description Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationError"];
                };
            };
        };
    };
}
