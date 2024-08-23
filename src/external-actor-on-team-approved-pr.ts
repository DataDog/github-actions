import * as core from "@actions/core";
import * as httpm from "@actions/http-client";
import { context, getOctokit } from "@actions/github";

process.on("unhandledRejection", handleError);
main().catch(handleError);

async function main(): Promise<any> {
  const http: httpm.HttpClient = new httpm.HttpClient(
    "actions/external-actor-on-team-approved-pr"
  );

  if (context.payload.pull_request == null) {
    core.debug("No pull request found in the context");
    return;
  }

  const apiToken = core.getInput("github-token", { required: true });
  const slackWebhookUrl = core.getInput("slack-webhook-url", {
    required: true,
  });

  const github = getOctokit(apiToken, {});

  // Get the team members
  const teamSlug = core.getInput("team-slug", { required: true });
  const { data: members } = await github.rest.teams.listMembersInOrg({
    org: context.repo.owner,
    team_slug: teamSlug,
  });
  const teamMemberLogins = members.map((member) => member.login);
  core.debug(`Team members retrieved: ${teamMemberLogins.join(", ")}`);

  // If the actor is a team member,
  // skip the Slack notification
  const actor = context.actor;
  if (teamMemberLogins.includes(actor)) {
    core.debug(
      `Actor is a team member (${actor}), skipping Slack notification.`
    );
    return;
  }

  // Get the list of reviewers who have approved the PR
  const { data: reviews } = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
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
        core.debug(
          `The PR is approved by a team member: ${approverLogin}. Notifying Slack ...`
        );
        break;
      }
    }
  }

  // If no one on the team has approved it yet,
  // skip the Slack notification
  if (!isApproved) {
    core.debug(
      "No team members have approved the PR yet, skipping Slack notification."
    );
    return;
  }

  // Fetch the PR details to send to Slack
  const { data: pullRequest } = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
  });

  // Notify Slack that a reviewed PR is ready to merge
  const body = {
    prLink: pullRequest.html_url,
    prTitle: pullRequest.title,
    prAuthor: pullRequest.user?.login || "unknown",
  };
  const slackResponse = await http.postJson(slackWebhookUrl, body);
  core.debug(`Response code from Slack: ${slackResponse.statusCode}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err: any): void {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
}
