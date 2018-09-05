const promisify = require('promisify-node');

const { JiraApi } = require('jira');
const gitlog = promisify('gitlog');
const path = require('path');
const commandLineArgs = require('command-line-args');
const fs = require('fs');

const workspace = path.resolve('../../../workspace');

const gitRepos = [
    'acceptancetesting',
    'admin',
    'ansible',
    'api2',
    'core',
    'deploy-bootstrapper',
    'deploy-config',
    'devlocal',
    'fe',
    'flipbook-services',
    'platform-docs',
    'reco-engine',
    'recommendation-api',
    'shout-extension',
    'shout-v2',
    'shout-v2-host',
    'shout-v2-host-outlook',
    'sso',
    'uploads',
    'webhooks',
    'widget'
];

// Options for Jira API
const optionDefinitions = [
    { name: 'username', alias: 'u', type: String },
    { name: 'password', alias: 'p', type: String },
];
const options = commandLineArgs(optionDefinitions);

if (!options.username) {
    throw new Error('Missing username argument.');
}
if (!options.password) {
    throw new Error('Missing password argument.');
}

const jira = new JiraApi(
    'https',
    'uberflip.atlassian.net',
    443,
    options.username,
    options.password,
    '2'
);

function promiseJiraFindIssue(issueNumber) {
    const result = new Promise((resolve, reject) => {
        jira.findIssue(issueNumber, (err, issue) => {
            if (err) {
                if (err === 'Invalid issue number.') {
                    // If the issue doesn't exist anymore, thats still okay.
                    console.log('Issue id is invalid, continuing...', `Issue Number: ${issueNumber}`)
                    resolve(false);
                } else {
                    console.log(`error ${issueNumber}`);
                    console.log('The error: ', err);
                    reject(err);
                }
            }
            return resolve(issue);
        })
    })
    return result;
}

function promiseJiraGetVersions(projectId) {
    const result = new Promise((resolve, reject) => {
        jira.getVersions(projectId, (err, version) => {
            if (err) {
                if (err === 'Invalid project ID.') {
                    // If the issue doesn't exist anymore, thats still okay.
                    console.log(
                        'Project id is invalid, continuing...',
                        `Project Id: ${projectId}`
                    );
                    resolve(false);
                } else {
                    console.log(`error ${projectId}`);
                    reject(err);
                }
            }
            return resolve(version);
        });
    });
    return result;
}

async function getIssueData(issueList) {
    const proms = issueList.map(issue => promiseJiraFindIssue(issue));
    try {
        const issueNames = await Promise.all(proms);
        return issueNames
            .filter(obj => obj) // Filter out the "false" values which come from now deleted Jira tickets
            .map(issue => issue);
    } catch (err) {
        console.log('here!', err)
    }
};

async function writeVersionsToFile(projectId) {
    const data = await getVersionData(projectId);
    // fs.writeFile(`./downloaded_data/jira_data/versions_${repo}.json`, JSON.stringify(commits, null, 2));
}

async function getVersionData(projectId) {
    const proms = promiseJiraGetVersions(projectId);
    try {
        const versionData = await Promise.all(proms);
        return versionData
            .filter(obj => obj) // Filter out the "false" values which come from now deleted Jira tickets
            .filter(version => (version.startDate > '2017-11-01' && version.startDate < '2018-04-06') || (version.releaseDate > '2017-11-01' && version.releaseDate < '2018-04-06'))
            .map(version => version);
    } catch (err) {
        console.log('here!', err);
    }
};

async function getCommits(options) {
    return await gitlog(options);
}

function getUniqueValues(value, index, self) {
    if (!value) return false;
    return self.indexOf(value) === index;
}

function writeCommitsToFile(commits, repo) {
    // uncomment to write to file
    // fs.writeFile(`./downloaded_data/commits/commits_${repo}.json`, JSON.stringify(commits, null, 2));
}

function writeIssuesInVersionsToFile(projectId) {

}

async function getIssuesInVersion(projectId) {
    const versionData = await getVersionData(projectId);
    const issueData = await getIssueData(issueList);
    const versionObj = {};
    versionData.forEach((version, index) => {
        const id = version.id;
        versionObj[index] = {
            id: [],
        };
        versionObj[index][id] = issueData.filter(issue => {
            return issue.fields.versions.indexOf(id) > 0;
        })
    })
}

// async function getJiraVersions(listOfIssues) {

//     const versionsBetweenDates = data.filter(issue => {
//         const startDate = issue.startDate;
//         const releaseDate = issue.releaseDate;
//         return (startDate > '2017-11-01' && startDate < '2018-04-06') || (releaseDate > '2017-11-01' && releaseDate < '2018-04-06');
//     })
//     getIssuesInVersion(versionsBetweenDates);
// }


async function getChangedJiraIssues(listOfIssues) {
    const jiraData = await getIssueData(listOfIssues);
    // issue.fields.created or issue.fields.updated is greater than 2017-11-01 or less than 2018-04-06
    const updatedIssues = jiraData.filter(issue => {
        return (issue.fields.created > '2017-11-01' && issue.fields.created < '2018-04-06')
            || (issue.fields.updated > '2017-11-01' && issue.fields.updated < '2018-04-06')
    })
    // fs.writeFile(`./downloaded_data/jira_data/changed_issues_${repo}.json`, JSON.stringify(commits, null, 2));
}

async function writeIssueDataToFile(listOfIssues) {
    const jiraData = await getIssueData(listOfIssues);
    const jiraObj = {};
    jiraData.forEach((issue, index) => {
        jiraObj[index] = {
            'key': issue.key,
            'url': issue.self,
            'id': issue.id,
            'summary': issue.fields.summary,
            'status': issue.fields.status,
            'resolution': issue.fields.resolution
        }
    })
    // uncomment to write to file
    // fs.writeFile('./downloaded_data/jira_data/info.json', JSON.stringify(jiraObj, null, 2));
}

async function getJiraIssueNumbers(commits) {
    const commitMessageRegex = /([A-Z]{3}[-][1-9]*)/; // regex to match the ABC-12345 format
    const listOfIssues = commits
        .map(commit => {
            let issueNumber = commit.subject;
            const result = commitMessageRegex.exec(issueNumber);
            if (issueNumber && result) {
                // grab the first full match of ABC-12345 from the beginning of the commit message
                return result[0];
            }
        })
        .filter(getUniqueValues); // filter out commits from the same branch
    writeIssueDataToFile(listOfIssues);
    getChangedJiraIssues(listOfIssues);
}

async function init() {
    try {
        // gitRepos.forEach(async repo => {
        const gitlogOptions = {
            repo: `${workspace}/core`,
            since: 'NOV 1 2017',
            until: 'APR 6 2018',
            number: '50000',
            all: true,
            execOptions:
            {
                maxBuffer: 1000 * 1024
            }

        };
        const commits = await getCommits(gitlogOptions);
        getJiraIssueNumbers(commits);
        // writeCommitsToFile(commits, repo);
        // writeVersionsToFile('DEV');
        // writeIssuesInVersionsToFile('DEV');
        // })

    } catch (err) {
        console.log(err);
    }
};

init();



