import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'

process.on('unhandledRejection', handleError)
main().catch(handleError)

async function main(): Promise<any> {
    const token = core.getInput('github-token', { required: true })
    const github = getOctokit(token, {})

    const owner = core.getInput('owner')
    const repo = core.getInput('repo')

    let pr_num = core.getInput('pull-request')
    if (pr_num == "") pr_num = context.payload.pull_request!.head.ref.split("/")[2] as string

    const { data: pr } = await github.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: +pr_num
    });
    const { data: jobs } = await github.actions.listJobsForWorkflowRun({
        owner: context.repo.owner,
        repo: context.repo.repo,
        run_id: context.runId
    });
    return github.repos.createCommitStatus({
        owner: owner,
        repo: repo,
        sha: pr.head.sha,
        state: core.getInput('status') as "pending" | "error" | "failure" | "success",
        target_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/pull/${context.payload.pull_request!.number}/checks?check_run_id=${jobs.jobs[0].id}`,
        description: context.workflow,
        context: `${context.repo.repo}/${core.getInput('context')}`
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(err: any): void {
    console.error(err)
    core.setFailed(`Unhandled error: ${err}`)
}