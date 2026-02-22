# Makefile for Date Range Reporter Plugin
# Builds a distributable zip file for Super Productivity

PROJECT = sp-dashboard
PLUGIN_DIR = $(PROJECT)
ZIP_FILE = $(PROJECT).zip
VERSION := $(shell grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
DESCRIPTION := $(shell grep '"description"' package.json | sed 's/.*"description": "\(.*\)".*/\1/')
RELEASE_FILE = $(PROJECT)-v$(VERSION).zip

.PHONY: build clean help release release-check test

# Default target
build: clean
	@echo "Building plugin zip file..."
	@echo "Preparing build directory..."
	@mkdir -p build/$(PLUGIN_DIR)
	@cp -R $(PLUGIN_DIR)/* build/$(PLUGIN_DIR)/
	@echo "Generating manifest.json from template..."
	@VERSION="$(VERSION)" DESCRIPTION="$(DESCRIPTION)" sh -c '\
		sed -e "s/{{VERSION}}/$$VERSION/g" -e "s|{{DESCRIPTION}}|$$DESCRIPTION|g" \
		$(PLUGIN_DIR)/manifest.json.template > build/$(PLUGIN_DIR)/manifest.json'
	@rm -f build/$(PLUGIN_DIR)/manifest.json.template
	@echo "Minifying HTML (inline CSS/JS preserved) -> build/$(PLUGIN_DIR)/index.html"
	@npm run build:min
	@cd build/$(PLUGIN_DIR) && zip -r ../../$(ZIP_FILE) . -x "manifest.json.template"
	@echo "✓ Plugin packaged successfully: $(ZIP_FILE)"

screenshot:
	@echo "Generating screenshot..."
	@node scripts/screenshot.js
	@echo "✓ Screenshot updated (assets/screenshot.png)"

# Clean up generated files
clean:
	@echo "Cleaning up..."
	@rm -f $(ZIP_FILE) $(RELEASE_FILE) $(PLUGIN_DIR)/manifest.json
	@rm -rf build
	@echo "✓ Cleaned"

# Run tests
test:
	@echo "Running tests..."
	@npm test
	@echo "✓ Tests completed"

# Pre-release checks
release-check:
	@echo "Checking prerequisites for release v$(VERSION)..."
	@if ! command -v gh >/dev/null 2>&1; then \
		echo "❌ Error: GitHub CLI (gh) is not installed"; \
		echo "   Install with: brew install gh"; \
		exit 1; \
	fi
	@if [ -z "$$(git status --porcelain)" ]; then \
		echo "✓ Working directory is clean"; \
	else \
		echo "❌ Error: Uncommitted changes found"; \
		echo "   Please commit or stash your changes first"; \
		exit 1; \
	fi
	@if git rev-parse "v$(VERSION)" >/dev/null 2>&1; then \
		echo "⚠️  Warning: Tag v$(VERSION) already exists"; \
		echo "   Delete it with: git tag -d v$(VERSION) && git push --delete origin v$(VERSION)"; \
		exit 1; \
	fi
	@echo "✓ All checks passed"

# Create a complete GitHub release (build, tag, push, and create release)
release: release-check build
	@echo ""
	@echo "════════════════════════════════════════════════════════════"
	@echo "Creating GitHub release v$(VERSION)"
	@echo "════════════════════════════════════════════════════════════"
	@echo ""
	@echo "→ Creating git tag v$(VERSION)..."
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@echo "✓ Tag created"
	@echo ""
	@echo "→ Pushing tag to origin..."
	@git push origin "v$(VERSION)"
	@echo "✓ Tag pushed"
	@echo ""
	@echo "→ Creating GitHub release..."
	@gh release create "v$(VERSION)" \
		--title "v$(VERSION)" \
		--notes "Release v$(VERSION) of $(PROJECT) plugin" \
		--generate-notes \
		$(ZIP_FILE)
	@echo ""
	@echo "════════════════════════════════════════════════════════════"
	@echo "✓ Release v$(VERSION) created successfully!"
	@echo "════════════════════════════════════════════════════════════"
	@echo ""
	@echo "View at: https://github.com/$$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/v$(VERSION)"

pr:
	gh pr create --fill

# Show help
help:
	@echo "$(PROJECT) Plugin - Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  make build         - Build the plugin zip file (default)"
	@echo "  make test          - Run unit tests"
	@echo "  make release       - Complete release process (v$(VERSION))"
	@echo "                       • Checks prerequisites"
	@echo "                       • Builds plugin zip"
	@echo "                       • Creates and pushes git tag"
	@echo "                       • Creates GitHub release"
	@echo "  make release-check - Verify release prerequisites"
	@echo "  make clean         - Remove generated zip files"
	@echo "  make screenshot     - Generate/update assets/screenshot.png via Puppeteer"
	@echo "  make help          - Show this help message"
	@echo ""
	@echo "Current version: $(VERSION)"
