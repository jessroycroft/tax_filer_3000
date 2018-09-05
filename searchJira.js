const { promisify } = require('es6-promisify');
const { JiraApi } = require('jira');

const jira = new JiraApi(
    'https',
    'uberflip.atlassian.net',
    443,
    'jess.roycroft@uberflip.com',
    'GarbageCatBen',
    'latest'
);

const searchJira = promisify(jira.searchJira.bind(jira));
function mapIssue(issue) {
    return {
        type: issue.fields.issuetype.name,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        createdDate: issue.fields.created,
        updated: issue.fields.updated,
        labels: issue.fields.labels,
        changelog: issue.changelog,
        resolution: issue.fields.resolution
    };
}

module.exports = async function getIssues(query, requestedStartAt = 0) {
    try {
        const options = {
            maxResults: 500,
            fields: [
                'issuetype',
                'summary',
                'status',
                'created',
                'updated',
                'labels',
                'changelog',
                'resolution'
            ],
            startAt: requestedStartAt,
        };

        const {
            startAt, maxResults, total, issues,
        } = await searchJira(query, options);

        const furthestObtained = maxResults + startAt;

        let additionalMappedIssues = [];
        if (furthestObtained < total) {
            // If there are more issues to get, recurse.
            additionalMappedIssues = await getIssues(query, startAt + maxResults);
        }

        const currentMappedIssues = issues.map(mapIssue);

        // Return combined array
        return [...currentMappedIssues, ...additionalMappedIssues];
    } catch (err) {
        console.log(err);

        // uh oh
        throw new Error(err);
    }
};