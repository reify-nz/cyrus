import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RepositoryConfig } from "../src/types.js";
import { PromptSystemFactory } from "../src/adapters/PromptSystemFactory.js";
import {
	BasePromptSystemAdapter,
	type PromptSystemAdapter,
	type PromptContext,
} from "../src/adapters/PromptSystemAdapter.js";
import type { LinearIssue } from "@linear/sdk";

// Mock adapter implementations for testing
class MockTraditionalAdapter extends BasePromptSystemAdapter {
	async prepareSystemPrompt(_context: PromptContext): Promise<string> {
		return "Traditional system prompt";
	}

	async prepareUserPrompt(
		_issue: LinearIssue,
		_context: PromptContext,
	): Promise<{ prompt: string; version?: string }> {
		return { prompt: "Traditional user prompt", version: "1.0.0" };
	}

	getToolRestrictions(_context: PromptContext): string[] {
		return ["Read", "Write"];
	}
}

class MockAgentOSAdapter extends BasePromptSystemAdapter {
	async prepareSystemPrompt(_context: PromptContext): Promise<string> {
		return "Agent OS system prompt";
	}

	async prepareUserPrompt(
		_issue: LinearIssue,
		_context: PromptContext,
	): Promise<{ prompt: string; version?: string }> {
		return { prompt: "Agent OS user prompt" };
	}

	getToolRestrictions(_context: PromptContext): string {
		return "safe";
	}
}

describe("PromptSystemFactory", () => {
	let mockConfig: RepositoryConfig;

	beforeEach(() => {
		// Clear factory state before each test
		PromptSystemFactory.clearCache();
		// Clear registry by accessing private static property (for testing)
		(PromptSystemFactory as any).adapterRegistry.clear();

		// Register mock adapters
		PromptSystemFactory.registerAdapter("traditional", MockTraditionalAdapter);
		PromptSystemFactory.registerAdapter("agent-os", MockAgentOSAdapter);

		// Create mock config
		mockConfig = {
			id: "test-repo",
			name: "Test Repository",
			repositoryPath: "/test/repo",
			workspaceBaseDir: "/test/workspaces",
			baseBranch: "main",
			linearToken: "test-token",
			linearWorkspaceId: "test-workspace",
		};
	});

	afterEach(() => {
		// Clean up after each test
		PromptSystemFactory.clearCache();
	});

	describe("Adapter Registration", () => {
		it("should register adapter types", () => {
			expect(PromptSystemFactory.isRegistered("traditional")).toBe(true);
			expect(PromptSystemFactory.isRegistered("agent-os")).toBe(true);
			expect(PromptSystemFactory.isRegistered("unknown")).toBe(false);
		});

		it("should return list of registered types", () => {
			const types = PromptSystemFactory.getRegisteredTypes();
			expect(types).toContain("traditional");
			expect(types).toContain("agent-os");
			expect(types).toHaveLength(2);
		});

		it("should allow registering new adapter types", () => {
			class CustomAdapter extends BasePromptSystemAdapter {
				async prepareSystemPrompt(): Promise<string> {
					return "Custom";
				}
				async prepareUserPrompt(): Promise<{ prompt: string }> {
					return { prompt: "Custom" };
				}
				getToolRestrictions(): string[] {
					return [];
				}
			}

			PromptSystemFactory.registerAdapter("custom", CustomAdapter);
			expect(PromptSystemFactory.isRegistered("custom")).toBe(true);
			expect(PromptSystemFactory.getRegisteredTypes()).toContain("custom");
		});
	});

	describe("Adapter Creation", () => {
		it("should create traditional adapter by default", async () => {
			const adapter = await PromptSystemFactory.createAdapter(mockConfig);
			expect(adapter).toBeInstanceOf(MockTraditionalAdapter);
		});

		it("should create traditional adapter when explicitly specified", async () => {
			const config = { ...mockConfig, promptSystem: "traditional" as const };
			const adapter = await PromptSystemFactory.createAdapter(config);
			expect(adapter).toBeInstanceOf(MockTraditionalAdapter);
		});

		it("should create agent-os adapter when specified", async () => {
			const config = { ...mockConfig, promptSystem: "agent-os" as const };
			const adapter = await PromptSystemFactory.createAdapter(config);
			expect(adapter).toBeInstanceOf(MockAgentOSAdapter);
		});

		it("should throw error for unknown adapter type", async () => {
			const config = { ...mockConfig, promptSystem: "unknown" as any };
			await expect(
				PromptSystemFactory.createAdapter(config),
			).rejects.toThrow("Unknown prompt system type: unknown");
		});

		it("should initialize adapter after creation", async () => {
			const initializeSpy = vi.spyOn(
				MockTraditionalAdapter.prototype,
				"initialize",
			);
			await PromptSystemFactory.createAdapter(mockConfig);
			expect(initializeSpy).toHaveBeenCalledWith(mockConfig);
		});
	});

	describe("Adapter Caching", () => {
		it("should cache created adapters", async () => {
			const adapter1 = await PromptSystemFactory.createAdapter(mockConfig);
			const adapter2 = await PromptSystemFactory.createAdapter(mockConfig);
			expect(adapter1).toBe(adapter2); // Same instance
		});

		it("should return cached adapter without re-initialization", async () => {
			const initializeSpy = vi.spyOn(
				MockTraditionalAdapter.prototype,
				"initialize",
			);

			await PromptSystemFactory.createAdapter(mockConfig);
			initializeSpy.mockClear();

			await PromptSystemFactory.createAdapter(mockConfig);
			expect(initializeSpy).not.toHaveBeenCalled();
		});

		it("should cache different adapters for different repositories", async () => {
			const config1 = { ...mockConfig, id: "repo1" };
			const config2 = { ...mockConfig, id: "repo2", promptSystem: "agent-os" as const };

			const adapter1 = await PromptSystemFactory.createAdapter(config1);
			const adapter2 = await PromptSystemFactory.createAdapter(config2);

			expect(adapter1).not.toBe(adapter2);
			expect(adapter1).toBeInstanceOf(MockTraditionalAdapter);
			expect(adapter2).toBeInstanceOf(MockAgentOSAdapter);
		});

		it("should get cached adapter by repository ID", async () => {
			const adapter = await PromptSystemFactory.createAdapter(mockConfig);
			const cached = PromptSystemFactory.getCachedAdapter(mockConfig.id);
			expect(cached).toBe(adapter);
		});

		it("should return null for non-cached repository", () => {
			const cached = PromptSystemFactory.getCachedAdapter("non-existent");
			expect(cached).toBeNull();
		});
	});

	describe("Cache Management", () => {
		it("should clear specific repository cache", async () => {
			const config1 = { ...mockConfig, id: "repo1" };
			const config2 = { ...mockConfig, id: "repo2" };

			await PromptSystemFactory.createAdapter(config1);
			await PromptSystemFactory.createAdapter(config2);

			PromptSystemFactory.clearCache("repo1");

			expect(PromptSystemFactory.getCachedAdapter("repo1")).toBeNull();
			expect(PromptSystemFactory.getCachedAdapter("repo2")).not.toBeNull();
		});

		it("should clear all caches when no repository ID provided", async () => {
			const config1 = { ...mockConfig, id: "repo1" };
			const config2 = { ...mockConfig, id: "repo2" };

			await PromptSystemFactory.createAdapter(config1);
			await PromptSystemFactory.createAdapter(config2);

			PromptSystemFactory.clearCache();

			expect(PromptSystemFactory.getCachedAdapter("repo1")).toBeNull();
			expect(PromptSystemFactory.getCachedAdapter("repo2")).toBeNull();
		});
	});

	describe("Error Handling", () => {
		it("should handle adapter initialization errors", async () => {
			class ErrorAdapter extends BasePromptSystemAdapter {
				async initialize(_config: RepositoryConfig): Promise<void> {
					throw new Error("Initialization failed");
				}
				async prepareSystemPrompt(): Promise<string> {
					return "";
				}
				async prepareUserPrompt(): Promise<{ prompt: string }> {
					return { prompt: "" };
				}
				getToolRestrictions(): string[] {
					return [];
				}
			}

			PromptSystemFactory.registerAdapter("error", ErrorAdapter);
			const config = { ...mockConfig, promptSystem: "error" as any };

			await expect(PromptSystemFactory.createAdapter(config)).rejects.toThrow(
				"Initialization failed",
			);

			// Should not be cached on error
			expect(PromptSystemFactory.getCachedAdapter(config.id)).toBeNull();
		});

		it("should provide helpful error message with available types", async () => {
			const config = { ...mockConfig, promptSystem: "invalid" as any };
			try {
				await PromptSystemFactory.createAdapter(config);
				expect.fail("Should have thrown");
			} catch (error: any) {
				expect(error.message).toContain("Unknown prompt system type: invalid");
				expect(error.message).toContain("Available types: traditional, agent-os");
			}
		});
	});
});
