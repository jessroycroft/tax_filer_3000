const { promisify } = require('es6-promisify');
const { JiraApi } = require('jira');
const commandLineArgs = require('command-line-args');

// Options for Jira API
const optionDefinitions = [
    { name: 'username', alias: 'u', type: String },
    { name: 'password', alias: 'p', type: String },
    { name: 'startDate', alias: 's', type: String },
    { name: 'endDate', alias: 'e', type: String },
    { name: 'directory', alias: 'd', type: String },
];
const options = commandLineArgs(optionDefinitions);

if (!options.username) {
    throw new Error('Missing username argument.');
}
if (!options.password) {
    throw new Error('Missing password argument.');
}

if (!options.startDate) {
    throw new Error('Missing start date argument.');
}
if (!options.endDate) {
    throw new Error('Missing end date argument.');
}

const jira = new JiraApi(
    'https',
    'uberflip.atlassian.net',
    443,
    options.username,
    options.password,
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