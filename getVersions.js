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

const getVersions = promisify(jira.getVersions.bind(jira));
function mapVersions(version) {
  return {
    id: version.id
  };
}

module.exports = async function getVersionIds(query, requestedStartAt = 0) {
  try {
    const options = {
      maxResults: 500,
      fields: [
        'id'
      ],
      startAt: requestedStartAt
    };

    const { startAt, maxResults, total, issues } = await getVersions(
      query,
      options
    );

    const furthestObtained = maxResults + startAt;

    let additionalMappedVersions = [];
    // if (furthestObtained < total) {
    //     // If there are more issues to get, recurse.
    //     additionalMappedIssues = await getIssues(query, startAt + maxResults);
    // }

    const currentMappedVersions = versions.map(mapVersions);

    // Return combined array
    return [...currentMappedVersions, ...additionalMappedVersions];
  } catch (err) {
    console.log(err);

    // uh oh
    throw new Error(err);
  }
};
