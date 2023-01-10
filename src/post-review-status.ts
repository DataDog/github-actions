import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

process.on("unhandledRejection", handleError);
main().catch(handleError);

async function main(): Promise<any> {
  const token = core.getInput("github-token", { required: true });
  const github = getOctokit(token, {});

  const owner = core.getInput("owner");
  const repo = core.getInput("repo");

  let pr_num = core.getInput("pull-request");
  if (pr_num == "")
    pr_num = context.payload.pull_request!.head.ref.split("/")[2] as string;

  const { data: pr } = await github.rest.pulls.get({
    owner: owner,
    repo: repo,
    pull_number: +pr_num,
  });

  let status: "pending" | "error" | "failure" | "success" = "pending";
  if (
    context.eventName === "pull_request_review" &&
    context.payload.action === "submitted"
  ) {
    if (context.payload.review.state === "approved") {
      status = "success";
    } else if (context.payload.review.state === "changes_requested") {
      status = "failure";
    }
  } else {
    const pr_id = context.payload.pull_request!.node_id;
    const query = `{
            node(id: "${pr_id}") {
                ... on PullRequest {
                    reviewDecision
                }
            }
        }`;
    const {
      node: { reviewDecision: review },
    } = await github.graphql(query, {});
    if (review === "APPROVED") {
      status = "success";
    } else if (review === "CHANGES_REQUESTED") {
      status = "failure";
    }
  }
  return github.rest.repos.createCommitStatus({
    owner: owner,
    repo: repo,
    sha: pr.head.sha,
    state: status,
    target_url: `https://github.com/${context.repo.owner}/${
      context.repo.repo
    }/pull/${context.payload.pull_request!.number}`,
    description: `status of ${context.repo.owner}/${context.repo.repo}#${
      context.payload.pull_request!.number
    }`,
    context: `${context.repo.repo}/review`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err: any): void {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
}
