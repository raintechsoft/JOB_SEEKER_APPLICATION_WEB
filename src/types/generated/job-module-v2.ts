/** Generated job v2 contracts. J3 operations implemented; import operations remain planned. */
export interface paths {
    "/api/v1/organizations/{organization}/hiring/imports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["jobV2_get__imports"];
        put?: never;
        post: operations["jobV2_post__imports"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["jobV2_get__imports__batch_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/mapping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["jobV2_put__imports__batch__mapping"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/positions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["jobV2_get__imports__batch__positions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/positions/{position}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["jobV2_patch__imports__batch__positions__position_"];
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/splits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["jobV2_post__imports__batch__splits"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["jobV2_post__imports__batch__drafts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/operations/{operation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["jobV2_get__imports__batch__operations__operation_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/imports/{batch}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["jobV2_post__imports__batch__cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["jobV2_post__drafts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/drafts/{draft}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["jobV2_patch__drafts__draft_"];
        trace?: never;
    };
    "/api/v1/organizations/{organization}/hiring/drafts/{draft}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["jobV2_post__drafts__draft__publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["jobV2_publicDetail"];
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
        /** @description Decimal currency units, at most 1000000000000.00; never an IEEE-754 number. */
        MoneyV2: string;
        CompensationStageV2: {
            label: string;
            startMonth: number;
            endMonth: number | null;
            amount: components["schemas"]["MoneyV2"] | null;
            period: ("hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement") | null;
        };
        CompensationAllowanceV2: {
            label: string;
            amount: components["schemas"]["MoneyV2"] | null;
            percent: components["schemas"]["MoneyV2"] | null;
        };
        CompensationV2: {
            kind: ("salary" | "stipend" | "honorarium") | null;
            /** @enum {string} */
            format: "fixed" | "range" | "up_to" | "pay_scale" | "schedule" | "unspecified";
            currency: ("INR" | "USD" | "EUR" | "GBP") | null;
            period: ("hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement") | null;
            minAmount: components["schemas"]["MoneyV2"] | null;
            maxAmount: components["schemas"]["MoneyV2"] | null;
            hidden: boolean;
            variableEnabled: boolean;
            variablePercent: components["schemas"]["MoneyV2"] | null;
            scaleLabel: string | null;
            notes: string;
            allowances: components["schemas"]["CompensationAllowanceV2"][];
            schedule: components["schemas"]["CompensationStageV2"][];
        };
        DeadlineV2: {
            date: string;
            time: string | null;
            timezone: string;
            offset: string | null;
        } | null;
        /** @description Optional recruitment-notice details shown to candidates. Display text only; never an automatic eligibility rule. noticeUrl is empty or an http(s) URL; opensOn is on or before the closing date. */
        NoticeDetailsV2: {
            ageLimit: string;
            selectionProcess: string;
            documents: string;
            applicationFee: string;
            noticeUrl: string;
            opensOn: string | null;
        };
        PublicCompensationV2: {
            /** @enum {string} */
            disclosure: "undisclosed" | "unspecified";
        } | {
            kind: ("salary" | "stipend" | "honorarium") | null;
            /** @enum {string} */
            format: "fixed" | "range" | "up_to" | "pay_scale" | "schedule";
            currency: ("INR" | "USD" | "EUR" | "GBP") | null;
            period: ("hour" | "day" | "week" | "month" | "year" | "case" | "duty" | "engagement") | null;
            minAmount: components["schemas"]["MoneyV2"] | null;
            maxAmount: components["schemas"]["MoneyV2"] | null;
            /** @constant */
            hidden: false;
            variableEnabled: boolean;
            variablePercent: components["schemas"]["MoneyV2"] | null;
            scaleLabel: string | null;
            notes: string;
            allowances: components["schemas"]["CompensationAllowanceV2"][];
            schedule: components["schemas"]["CompensationStageV2"][];
            /** @enum {string} */
            disclosure: "specified";
        };
        /** @description Version 2 job payload accepted by the negotiated J3 editor endpoints. Cross-field rules and semantic examples accompany this schema; JSON Schema alone cannot compare sibling amounts or resolve timezone transitions. */
        JobDraftValuesV2: {
            companyName: string;
            title: string;
            role: string;
            description: string;
            responsibilities: string;
            requirements: string;
            benefits: string;
            reference: string;
            applicationInstructions: string;
            hideCompany: boolean;
            relocate: boolean;
            requirePortfolio: boolean;
            notifyResponses: boolean;
            /** @enum {string} */
            department: "" | "Design" | "Engineering" | "Product" | "Data & analytics" | "Sales & retail" | "Marketing" | "Operations" | "Human resources" | "Finance" | "Other";
            /** @enum {string} */
            employment: "" | "Full-time" | "Part-time" | "Contract" | "Internship" | "Apprenticeship" | "Consultancy" | "Deputation" | "Empanelment";
            /** @enum {string} */
            arrangement: "" | "On-site" | "Hybrid" | "Remote";
            experienceMin: number | null;
            experienceMax: number | null;
            vacancies: number | null;
            contactEmail: string;
            locations: string[];
            skills: string[];
            essentialSkills: string[];
            education: ("Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification")[];
            industries: string[];
            questions: components["schemas"]["ScreeningQuestion"][];
            thumbnail: components["schemas"]["JobThumbnail"];
            jobMedia: components["schemas"]["JobMedia"];
            aiVerified?: boolean;
            /** @constant */
            schemaVersion: 2;
            compensation: components["schemas"]["CompensationV2"];
            deadline: components["schemas"]["DeadlineV2"];
            notice?: components["schemas"]["NoticeDetailsV2"];
        };
        /** @description Also requires complete compensation, questions, conditional thumbnail alt and current server availability/source review. Business relationships are checked independently by both implementations. */
        JobPublishValuesV2: components["schemas"]["JobDraftValuesV2"] & {
            companyName?: string;
            title?: string;
            department?: string;
            role?: string;
            employment?: string;
            experienceMin?: number;
            arrangement?: string;
            locations?: unknown;
            skills?: unknown;
            education?: unknown;
            description?: string;
            responsibilities?: string;
            requirements?: string;
            contactEmail?: string;
        };
        JobStageAdvanceV2: {
            values: components["schemas"]["JobDraftValuesV2"];
            step: number;
            reached: number;
            version: number;
            jobVersion: number;
            generated?: {
                /** @enum {string} */
                mode: "template-demo";
                role: string;
                /** Format: date-time */
                at: string;
            } | null;
        };
        JobPublishRequestV2: {
            values: components["schemas"]["JobPublishValuesV2"];
            step: number;
            reached: number;
            version: number;
            jobVersion: number;
            generated?: {
                /** @enum {string} */
                mode: "template-demo";
                role: string;
                /** Format: date-time */
                at: string;
            } | null;
        };
        JobDraftV2: {
            /** Format: uuid */
            id: string;
            existingId: string | "";
            version: number;
            jobVersion: number;
            step: number;
            reached: number;
            values: components["schemas"]["JobDraftValuesV2"];
            savedAt: string;
            generated?: {
                /** @constant */
                mode: "template-demo";
                role: string;
                at: string;
            } | false;
        };
        JobDraftContextV2: {
            /** Format: uuid */
            key: string;
            draft: components["schemas"]["JobDraftV2"];
            editingPublished: boolean;
            companyName: string;
            /** Format: uuid */
            companyId: string;
            latestJobVersion?: number;
            latestJob?: components["schemas"]["HiringJobPrivateV2"] | null;
        };
        /** @description Public view only: no editable wizard values, recruiter contact, source-review evidence or confidential pay. The legacy salary string remains a display label with the real period; it is not a numeric annual fallback. */
        HiringJobV2: {
            /** Format: uuid */
            id: string;
            company: string;
            title: string;
            companyDisplayName: string;
            hideCompany: boolean;
            hideSalary: boolean;
            department: string;
            role: string;
            location: string;
            arrangement: string;
            employment: string;
            salary: string;
            skills: string[];
            description: string;
            responsibilities: string[];
            requirements: string;
            benefits: string;
            createdAt: string;
            publishedAt: string | null;
            likes: number;
            art: string;
            draft: boolean;
            closed: boolean;
            screeningQuestions: components["schemas"]["ScreeningQuestion"][];
            questionsVersion: number;
            requirePortfolio: boolean;
            applicationInstructions: string;
            expiresAt: string;
            thumbnail: components["schemas"]["JobThumbnail"];
            jobMedia: components["schemas"]["JobMedia"];
            version: number;
            wizardValues: {
                education: ("Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification")[];
                experienceMin: number | null;
                experienceMax: number | null;
                vacancies: number | null;
            };
            workflowStep?: number;
            /** @constant */
            schemaVersion: 2;
            compensation: components["schemas"]["PublicCompensationV2"];
            deadline: components["schemas"]["DeadlineV2"];
            notice: components["schemas"]["NoticeDetailsV2"];
            closesAt: string | null;
            experienceMin: number;
            experienceMax: number | null;
            vacancies: number | null;
            education: ("Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification")[];
        };
        /** @description Public view only: no editable wizard values, recruiter contact, source-review evidence or confidential pay. The legacy salary string remains a display label with the real period; it is not a numeric annual fallback. */
        HiringJobPrivateV2: {
            /** Format: uuid */
            id: string;
            company: string;
            title: string;
            companyDisplayName: string;
            hideCompany: boolean;
            hideSalary: boolean;
            department: string;
            role: string;
            location: string;
            arrangement: string;
            employment: string;
            salary: string;
            skills: string[];
            description: string;
            responsibilities: string[];
            requirements: string;
            benefits: string;
            createdAt: string;
            publishedAt: string | null;
            likes: number;
            art: string;
            draft: boolean;
            closed: boolean;
            screeningQuestions: components["schemas"]["ScreeningQuestion"][];
            questionsVersion: number;
            requirePortfolio: boolean;
            applicationInstructions: string;
            expiresAt: string;
            thumbnail: components["schemas"]["JobThumbnail"];
            jobMedia: components["schemas"]["JobMedia"];
            version: number;
            wizardValues: components["schemas"]["JobDraftValuesV2"];
            workflowStep?: number;
            /** @constant */
            schemaVersion: 2;
            compensation: components["schemas"]["CompensationV2"];
            deadline: components["schemas"]["DeadlineV2"];
            notice: components["schemas"]["NoticeDetailsV2"];
            closesAt: string | null;
            experienceMin: number;
            experienceMax: number | null;
            vacancies: number | null;
            education: ("Any graduate" | "Any qualification" | "Undergraduate" | "Diploma" | "Bachelor’s degree" | "Master’s degree" | "Doctorate" | "Class 8" | "Class 10 / SSLC" | "Class 12 / HSC" | "ITI" | "CA" | "CMA" | "CS" | "Professional qualification")[];
            reference?: string;
            postedBy?: string;
            collaborationNote?: string;
            collaborators?: string[];
        };
        JobDetailV2: {
            job: components["schemas"]["HiringJobV2"];
            company: components["schemas"]["HiringCompany"];
            saved: boolean;
            application: components["schemas"]["PersonalApplication"] | null;
            ownedByViewer: boolean;
        };
        ImportStart: {
            /** Format: uuid */
            sourceAssetId: string;
            /** Format: uuid */
            idempotencyKey: string;
        };
        ImportFile: {
            name: string;
            bytes: number;
        };
        ImportMapping: {
            version: number;
            sheet: string;
            headerRow: number;
            /** @enum {string} */
            preset: "skillora" | "tn-government-research";
            timezone: string;
            columns: {
                sourceId?: number;
                employer?: number;
                title: number;
                vacancies?: number;
                location?: number;
                sourceStatus?: number;
                date?: number;
                dateCaution?: number;
                eligibility?: number;
                age?: number;
                compensation?: number;
                sourceApplicationMethod?: number;
                sourceFee?: number;
                sourceUrl?: number;
                noticeUrl?: number;
                additionalUrls?: number;
                verification?: number;
                secondaryUrl?: number;
                selection?: number;
                documents?: number;
            };
        };
        ImportResolution: {
            /** @enum {string} */
            issue: "missing_fields" | "unconfirmed" | "expired" | "not_open" | "ambiguous_deadline" | "conflicting_location" | "combined_positions" | "ambiguous_compensation" | "possible_duplicate" | "invalid_values";
            /** @enum {string} */
            kind: "confirmed" | "corrected" | "not_applicable" | "skip";
            note: string;
        };
        ImportPositionReview: {
            version: number;
            values: components["schemas"]["JobDraftValuesV2"];
            resolutions: components["schemas"]["ImportResolution"][];
        };
        ImportSplits: {
            version: number;
            /** Format: uuid */
            rowId: string;
            positions: {
                sourcePositionKey: string;
                values: components["schemas"]["JobDraftValuesV2"];
            }[];
        };
        ImportDraftSelection: {
            version: number;
            /** Format: uuid */
            idempotencyKey: string;
            positions: {
                /** Format: uuid */
                id: string;
                version: number;
            }[];
        };
        ImportCancel: {
            version: number;
        };
        ImportOperation: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            state: "pending" | "running" | "completed" | "failed" | "cancelled";
            total: number;
            processed: number;
            results: {
                /** Format: uuid */
                positionId: string;
                /** @enum {string} */
                status: "created" | "already_created" | "skipped" | "conflict" | "failed";
                jobId: string | null;
                draftKey: string | null;
                errorCode: string | null;
            }[];
        };
        ImportBatch: {
            /** Format: uuid */
            id: string;
            version: number;
            /** @enum {string} */
            state: "inspecting" | "awaiting_mapping" | "parsing" | "review" | "creating_drafts" | "completed" | "failed" | "cancelled";
            sourceRows: number;
            positions: number;
            sourceSha256: string;
            sheets: string[];
        };
        ImportPosition: {
            /** Format: uuid */
            id: string;
            version: number;
            sourceRow: number;
            sourcePositionKey: string;
            /** @enum {string} */
            state: "needs_review" | "ready_for_draft" | "draft_created" | "skipped" | "failed";
            values: components["schemas"]["JobDraftValuesV2"];
            issues: ("missing_fields" | "unconfirmed" | "expired" | "not_open" | "ambiguous_deadline" | "conflicting_location" | "combined_positions" | "ambiguous_compensation" | "possible_duplicate" | "invalid_values")[];
            canCreateDraft: boolean;
            canPublish: boolean;
            jobId: string | null;
            draftKey: string | null;
        };
        ImportBatchPage: {
            items: components["schemas"]["ImportBatch"][];
            total: number;
            page: number;
            pageSize: number;
        };
        ImportPositionsPage: {
            items: components["schemas"]["ImportPosition"][];
            total: number;
            page: number;
            pageSize: number;
        };
        ScreeningQuestion: {
            /** Format: uuid */
            id: string;
            text: string;
            /** @enum {string} */
            type: "text" | "yesno" | "number";
            required: boolean;
            ideal: string;
            version?: number;
        };
        JobThumbnail: {
            /** @enum {string} */
            template: "cobalt" | "sage" | "graphite" | "lavender" | "none";
            image: string;
            alt: string;
            headline: string;
        };
        JobMedia: {
            video: string;
            files: components["schemas"]["JobMediaFile"][];
        };
        HiringCompany: {
            id: string;
            name: string;
            industry?: string;
            logoUrl?: string;
            confidential?: boolean;
            followerCount?: number;
        };
        PersonalApplication: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            job: string;
            name: string;
            email: string;
            note: string;
            portfolio: boolean;
            recruitmentDetails: components["schemas"]["RecruitmentDetails"];
            screeningAnswers: {
                /** Format: uuid */
                id: string;
                question: string;
                answer: string;
            }[];
            createdAt: string;
            /** @enum {string} */
            status: "Applied" | "In review" | "Shortlisted" | "Interview" | "Offer" | "Hired" | "Rejected" | "Withdrawn";
            /** @enum {string} */
            trackingStatus: "Applied" | "In review" | "Interview" | "Offer" | "Rejected" | "Withdrawn";
            /** @enum {string} */
            statusSource: "submitted" | "employer" | "withdrawn";
            trackingNote: string;
            followUp: string;
            updatedAt: string;
            jobRef: components["schemas"]["JobRef"];
            version: number;
            /** @enum {string} */
            employerStage: "New" | "Reviewing" | "Shortlisted" | "Interview" | "Hired" | "Rejected";
            withdrawnAt: string | null;
        };
        JobMediaFile: {
            /** Format: uuid */
            id: string;
            name: string;
            /** @enum {string} */
            type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "video/mp4" | "video/webm";
            size: number;
            data: string;
        };
        RecruitmentDetails: {
            location?: string;
            locality?: string;
            expectedSalaryLpa?: string;
            noticeDays?: string;
            joiningDays?: string;
            industry?: string;
            designation?: string;
            department?: string;
            preferredLocations?: string;
            phone?: string;
        };
        JobRef: {
            /** Format: uuid */
            id: string;
            title: string;
            companyId: string;
            companyName: string;
            location: string;
            arrangement: string;
            employment: string;
            salary: string;
            description: string;
        };
        JobDraftOpenV2: {
            /** Format: uuid */
            job_id?: string;
            /** Format: uuid */
            creation_key?: string;
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
    jobV2_get__imports: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatchPage"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__imports: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportStart"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatch"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_get__imports__batch_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatch"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_put__imports__batch__mapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportMapping"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatch"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_get__imports__batch__positions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportPositionsPage"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_patch__imports__batch__positions__position_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
                position: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportPositionReview"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportPosition"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__imports__batch__splits: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportSplits"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatch"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__imports__batch__drafts: {
        parameters: {
            query?: never;
            header: {
                /** @description J3 payload negotiation. Header and body schemaVersion must agree. Old clients cannot submit non-annual v2 values as v1. */
                "X-Skillora-Job-Schema": 2;
            };
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportDraftSelection"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportOperation"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_get__imports__batch__operations__operation_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
                operation: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportOperation"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__imports__batch__cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization: string;
                batch: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImportCancel"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ImportBatch"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__drafts: {
        parameters: {
            query?: never;
            header: {
                /** @description J3 payload negotiation. Header and body schemaVersion must agree. Old clients cannot submit non-annual v2 values as v1. */
                "X-Skillora-Job-Schema": 2;
            };
            path: {
                organization: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobDraftOpenV2"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["JobDraftContextV2"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_patch__drafts__draft_: {
        parameters: {
            query?: never;
            header: {
                /** @description J3 payload negotiation. Header and body schemaVersion must agree. Old clients cannot submit non-annual v2 values as v1. */
                "X-Skillora-Job-Schema": 2;
            };
            path: {
                organization: string;
                draft: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobStageAdvanceV2"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["JobDraftV2"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_post__drafts__draft__publish: {
        parameters: {
            query?: never;
            header: {
                /** @description J3 payload negotiation. Header and body schemaVersion must agree. Old clients cannot submit non-annual v2 values as v1. */
                "X-Skillora-Job-Schema": 2;
            };
            path: {
                organization: string;
                draft: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobPublishRequestV2"];
            };
        };
        responses: {
            /** @description Validated versioned result; import endpoints remain planned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["JobDraftV2"];
                    };
                };
            };
            /** @description Denied by current membership/resource policy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Revision, duplicate-key or business-state conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Field validation errors */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Rate limit; honor Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    jobV2_publicDetail: {
        parameters: {
            query?: never;
            header: {
                "X-Skillora-Job-Schema": 2;
            };
            path: {
                job: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Safe public v2 job projection */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["JobDetailV2"];
                    };
                };
            };
            /** @description Absent or unavailable */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
