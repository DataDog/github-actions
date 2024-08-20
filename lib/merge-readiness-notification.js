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
const httpm = __importStar(require("@actions/http-client"));
const github_1 = require("@actions/github");
process.on("unhandledRejection", handleError);
main().catch(handleError);
async function main() {
    var _a;
    const http = new httpm.HttpClient("merge-readiness-notification");
    if (github_1.context.payload.pull_request == null) {
        console.log("No pull request found in the context");
        return;
    }
    const apiToken = core.getInput("api-token", { required: true });
    const slackWebhookUrl = core.getInput("slack-webhook-url", {
        required: true,
    });
    const github = github_1.getOctokit(apiToken, {});
    // Get the team members
    const teamSlug = core.getInput("team-slug", { required: true });
    const { data: members } = await github.rest.teams.listMembersInOrg({
        org: github_1.context.repo.owner,
        team_slug: teamSlug,
    });
    const teamMemberLogins = members.map((member) => member.login);
    console.log(`Team members retrieved: ${teamMemberLogins.join(", ")}`);
    // If the actor is a team member,
    // skip the Slack notification
    const actor = github_1.context.actor;
    if (teamMemberLogins.includes(actor)) {
        console.log(`Actor is a team member (${actor}), skipping Slack notification.`);
        return;
    }
    // Get the list of reviewers who have approved the PR
    const { data: reviews } = await github.rest.pulls.listReviews({
        owner: github_1.context.repo.owner,
        repo: github_1.context.repo.repo,
        pull_number: github_1.context.payload.pull_request.number,
    });
    let isApproved = false;
    // Check whether any of the team members
    // have approved the PR
    for (const review of reviews) {
        if (review.state === "APPROVED") {
            if (review.user == null) {
                continue;
            }
            const approverLogin = review.user.login;
            if (teamMemberLogins.includes(approverLogin)) {
                isApproved = true;
                console.log(`The PR is approved by a team member: ${approverLogin}. Notifying Slack ...`);
                break;
            }
        }
    }
    // If no one on the team has approved it yet,
    // skip the Slack notification
    if (!isApproved) {
        console.log("No team members have approved the PR yet, skipping Slack notification.");
        return;
    }
    // Fetch the PR details to send to Slack
    const { data: pullRequest } = await github.rest.pulls.get({
        owner: github_1.context.repo.owner,
        repo: github_1.context.repo.repo,
        pull_number: github_1.context.payload.pull_request.number,
    });
    // Notify Slack that a reviewed PR is ready to merge
    const body = {
        prLink: pullRequest.html_url,
        prTitle: pullRequest.title,
        prAuthor: ((_a = pullRequest.user) === null || _a === void 0 ? void 0 : _a.login) || "unknown",
    };
    const slackResponse = await http.postJson(slackWebhookUrl, body);
    console.log("Response code from Slack:", slackResponse.statusCode);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err) {
    console.error(err);
    core.setFailed(`Unhandled error: ${err}`);
}
//# sourceMappingURL=merge-readiness-notification.js.map