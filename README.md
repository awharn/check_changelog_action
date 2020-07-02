## Inputs

### `header`

**Required** The header that the action looks for in the changelog. Default: `## Recent Changes`

### `file`

**Required** The path to the changelog. Default: `CHANGELOG.md`

### `token`

**Required** The repository's GITHUB_TOKEN.

## Outputs

### `changed`

Whether or not the changelog was detected in the PR diff.

### `header`

Whether or not the header was detected in the PR diff.

## Example usage

```yaml
uses: awharn/check_changelog_action@master
with:
  header: '## Recent Chagnes'
  file: 'CHANGELOG.md'
  token: ${{ secrets.GITHUB_TOKEN }}
```
