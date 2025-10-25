export interface GitHubRelease {
  version: string;
  date: string;
  body: string;
}

/**
 * Fetch releases from GitHub API
 *
 * @example
 *   const releases = await fetchGitHubReleases();
 *   console.log(releases[0].version); // "1.31.2"
 *
 * @returns Array of GitHub releases
 */
const fetchGitHubReleases = async (): Promise<GitHubRelease[]> => {
  try {
    const response = await fetch(
      'https://api.github.com/repos/craftandculture/Craft-Culture/releases',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
        next: {
          revalidate: 3600, // Cache for 1 hour
        },
      },
    );

    if (!response.ok) {
      console.error('Failed to fetch GitHub releases:', response.statusText);
      return [];
    }

    const releases = await response.json();

    return releases.map((release: {
      tag_name: string;
      published_at: string;
      body: string;
    }) => ({
      version: release.tag_name.replace(/^v/, ''), // Remove 'v' prefix
      date: release.published_at.split('T')[0] ?? '', // Extract date part
      body: release.body ?? '',
    }));
  } catch (error) {
    console.error('Error fetching GitHub releases:', error);
    return [];
  }
};

export default fetchGitHubReleases;
