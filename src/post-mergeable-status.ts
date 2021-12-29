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

    const { data: pr } = await github.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: +pr_num,
    });

    const pr_id = context.payload.pull_request!.node_id;
    const query = `{
            node(id: "${pr_id}") {
                ... on PullRequest {
                    mergeStateStatus
                }
            }
        }`;
    const headers = {
        accept: "application/vnd.github.merge-info-preview+json",
    }

    let maxRetries:number = 5;
    let success:boolean = false;
    let status: "pending" | "error" | "failure" | "success" = "pending";

    while (!success && maxRetries > 0) {
        // @ts-ignore
        let { node: { mergeStateStatus: stateStatus } } = await github.graphql({query: query, headers: headers}, {});
        if (stateStatus === "UNKNOWN") {
            // sleep for a second
            setTimeout(() => {maxRetries-=1}, 1000);
        } else if (stateStatus === "HAS_HOOKS") {
            success = true;
            status = "success";
        } else {
            success = true;
            status = "failure";
        }
    }

    return github.repos.createCommitStatus({
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
        context: `${context.repo.repo}/mergeable`,
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err: any): void {
    console.error(err);
    core.setFailed(`Unhandled error: ${err}`);
}
