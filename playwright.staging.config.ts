import {defineConfig} from "@playwright/test";

export default defineConfig({
 testDir:"tests/e2e-staging",
 outputDir:"../../.runtime/staging/browser-results",
 workers:1,retries:0,timeout:45000,
 use:{baseURL:"http://127.0.0.1:3480",channel:process.env.PW_CHANNEL??"msedge",trace:"off",screenshot:"off",video:"off"},
 reporter:[["list"]],
});
