## Inputs

### `header`

**Required** The header that the action looks for in the changelog. Default: `## Recent Changes`

### `file`

The path to the changelog, or the name of the changelog if Lerna is in use. Default: `CHANGELOG.md`

### `lerna`

Whether or not this is a lerna monorepo. Default: `false`

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
  lerna: 'false'
```
