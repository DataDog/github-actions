"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
process.on("unhandledRejection", handleError);
main().catch(handleError);
async function main() {
    const token = core.getInput("github-token", { required: true });
    const github = github_1.getOctokit(token, {});
    const owner = core.getInput("owner");
    const repo = core.getInput("repo");
    let pr_num = core.getInput("pull-request");
    if (pr_num == "")
        pr_num = github_1.context.payload.pull_request.head.ref.split("/")[2];
    const { data: pr } = await github.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: +pr_num,
    });
    const pr_id = github_1.context.payload.pull_request.node_id;
    const query = `{
            node(id: "${pr_id}") {
                ... on PullRequest {
                    mergeStateStatus
                }
            }
        }`;
    const headers = {
        accept: "application/vnd.github.merge-info-preview+json",
    };
    let maxRetries = 5;
    let success = false;
    let status = "pending";
    while (!success && maxRetries > 0) {
        // @ts-ignore
        let { node: { mergeStateStatus: stateStatus } } = await github.graphql({ query: query, headers: headers }, {});
        if (stateStatus === "UNKNOWN") {
            // sleep for a second
            setTimeout(() => { maxRetries -= 1; }, 1000);
        }
        else if (stateStatus === "HAS_HOOKS") {
            success = true;
            status = "success";
        }
        else {
            success = true;
            status = "failure";
        }
    }
    return github.repos.createCommitStatus({
        owner: owner,
        repo: repo,
        sha: pr.head.sha,
        state: status,
        target_url: `https://github.com/${github_1.context.repo.owner}/${github_1.context.repo.repo}/pull/${github_1.context.payload.pull_request.number}`,
        description: `status of ${github_1.context.repo.owner}/${github_1.context.repo.repo}#${github_1.context.payload.pull_request.number}`,
        context: `${github_1.context.repo.repo}/mergeable`,
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err) {
    console.error(err);
    core.setFailed(`Unhandled error: ${err}`);
}
//# sourceMappingURL=post-mergeable-status.js.map