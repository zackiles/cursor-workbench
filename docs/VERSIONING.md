# Versioning & Release Process

This document explains how to create new releases of the Custom File Editor extension using the automated GitHub workflows.

## Release Workflow

The project uses GitHub Actions to automatically build and release the extension when version tags are pushed.

### Automated Process

1. **Push code changes** to the `main` branch
2. **Create and push a version tag** (triggers the release)
3. **GitHub Actions automatically**:
   - Runs tests and builds the extension
   - Packages the `.vsix` file
   - Creates a GitHub release with release notes
   - Attaches the extension package as a release asset

## Creating a New Release

### Step 1: Update Version

Update the version in `package.json`:

```json
{
  "version": "0.0.2"
}
```

### Step 2: Commit Changes

```bash
git add package.json
git commit -m "Bump version to 0.0.2"
git push origin main
```

### Step 3: Create Version Tag

```bash
# Create and push the version tag
git tag v0.0.2
git push origin v0.0.2
```

### Step 4: Wait for Automation

The GitHub Actions will automatically:
1. **Test workflow** runs first (validates build and tests)
2. **Release workflow** runs after tests pass
3. **Creates release** with the packaged extension

## Tag Format

Tags must follow the format: `v[MAJOR].[MINOR].[PATCH]`

Examples:
- ✅ `v0.0.1`
- ✅ `v1.2.3`
- ✅ `v2.0.0`
- ❌ `0.0.1` (missing 'v' prefix)
- ❌ `v1.2` (missing patch version)

## Release Notes

The release workflow automatically generates release notes that include:

- Extension features and description
- Installation instructions (both CLI and UI methods)
- Usage instructions
- Package size and compatibility info
- File extensions supported

## Manual Release (If Needed)

If you need to create a release manually:

```bash
# Build and package locally
npm run build
npm run package

# Create release through GitHub UI
# Upload the .vsix file as a release asset
```

## Troubleshooting

### Release Workflow Not Triggering

- **Check tag format**: Must be `v[0-9]+.[0-9]+.[0-9]+`
- **Check test status**: Release only runs if tests pass
- **Check permissions**: Repository needs `contents: write` permission

### Build Failures

- **Dependencies**: Ensure `package.json` dependencies are correct
- **Node version**: GitHub Actions uses Node.js 18
- **vsce tool**: Automatically installed in the workflow

### Version Conflicts

If you need to fix a release:

```bash
# Delete the tag locally and remotely
git tag -d v0.0.2
git push origin :refs/tags/v0.0.2

# Fix issues, commit, and recreate tag
git commit -m "Fix release issues"
git tag v0.0.2
git push origin v0.0.2
```

## Release Checklist

Before creating a release:

- [ ] Update version in `package.json`
- [ ] Test locally: `npm run test:local`
- [ ] Verify package builds: `npm run verify:package`
- [ ] Update `CHANGELOG.md` if it exists
- [ ] Commit all changes
- [ ] Create and push version tag
- [ ] Verify GitHub Actions complete successfully
- [ ] Test the released extension installation

## Continuous Integration

The project includes two workflows:

### `.github/workflows/test.yml`
- Triggers on: Push to main, pull requests, version tags
- Actions: Install dependencies, run tests, build, package
- Uploads: Build artifacts for verification

### `.github/workflows/release.yml`
- Triggers on: Successful test workflow completion
- Conditions: Only runs for commits with version tags
- Actions: Build, package, create GitHub release
- Outputs: Published extension ready for installation

This ensures every release is automatically tested and validated before being made available to users.
