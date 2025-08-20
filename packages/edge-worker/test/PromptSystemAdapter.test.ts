import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LinearIssue } from "@linear/sdk";
import type { RepositoryConfig } from "../src/types.js";
import type {
	PromptSystemAdapter,
	PromptContext,
} from "../src/adapters/PromptSystemAdapter.js";

describe("PromptSystemAdapter Interface", () => {
	let mockAdapter: PromptSystemAdapter;
	let mockConfig: RepositoryConfig;
	let mockContext: PromptContext;
	let mockIssue: LinearIssue;

	beforeEach(() => {
		// Create mock repository config
		mockConfig = {
			id: "test-repo",
			name: "Test Repository",
			repositoryPath: "/test/repo",
			workspaceBaseDir: "/test/workspaces",
			baseBranch: "main",
			linearToken: "test-token",
			linearWorkspaceId: "test-workspace",
		};

		// Create mock Linear issue
		mockIssue = {
			id: "issue-123",
			identifier: "TEST-123",
			title: "Test Issue",
			description: "Test description",
			url: "https://linear.app/test/issue/TEST-123",
			branchName: "test-branch",
		} as LinearIssue;

		// Create mock context
		mockContext = {
			repository: mockConfig,
			issue: mockIssue,
			labels: ["bug", "priority"],
			promptType: "debugger",
			attachmentManifest: "",
			isNewSession: true,
			isMentionTriggered: false,
		};

		// Create mock adapter implementation
		mockAdapter = {
			initialize: vi.fn().mockResolvedValue(undefined),
			prepareSystemPrompt: vi.fn().mockResolvedValue("System prompt"),
			prepareUserPrompt: vi.fn().mockResolvedValue({
				prompt: "User prompt",
				version: "1.0.0",
			}),
			getToolRestrictions: vi.fn().mockReturnValue(["Read", "Write"]),
			handleResponse: vi.fn().mockResolvedValue(undefined),
		};
	});

	describe("Interface Contract", () => {
		it("should have initialize method that accepts RepositoryConfig", async () => {
			await mockAdapter.initialize(mockConfig);
			expect(mockAdapter.initialize).toHaveBeenCalledWith(mockConfig);
		});

		it("should have prepareSystemPrompt method that returns string or undefined", async () => {
			const result = await mockAdapter.prepareSystemPrompt(mockContext);
			expect(mockAdapter.prepareSystemPrompt).toHaveBeenCalledWith(mockContext);
			expect(typeof result === "string" || result === undefined).toBe(true);
		});

		it("should have prepareUserPrompt method that returns prompt and optional version", async () => {
			const result = await mockAdapter.prepareUserPrompt(
				mockIssue,
				mockContext,
			);
			expect(mockAdapter.prepareUserPrompt).toHaveBeenCalledWith(
				mockIssue,
				mockContext,
			);
			expect(result).toHaveProperty("prompt");
			expect(typeof result.prompt).toBe("string");
			if (result.version) {
				expect(typeof result.version).toBe("string");
			}
		});

		it("should have getToolRestrictions method that returns tools array or preset", () => {
			const result = mockAdapter.getToolRestrictions(mockContext);
			expect(mockAdapter.getToolRestrictions).toHaveBeenCalledWith(mockContext);
			expect(
				Array.isArray(result) ||
					["readOnly", "safe", "all"].includes(result as string),
			).toBe(true);
		});

		it("should have handleResponse method that processes Claude responses", async () => {
			const mockResponse = { text: "Claude's response" };
			await mockAdapter.handleResponse(mockResponse, mockContext);
			expect(mockAdapter.handleResponse).toHaveBeenCalledWith(
				mockResponse,
				mockContext,
			);
		});
	});

	describe("PromptContext Interface", () => {
		it("should contain required repository configuration", () => {
			expect(mockContext.repository).toBeDefined();
			expect(mockContext.repository.id).toBe("test-repo");
		});

		it("should contain Linear issue information", () => {
			expect(mockContext.issue).toBeDefined();
			expect(mockContext.issue.id).toBe("issue-123");
		});

		it("should contain issue labels array", () => {
			expect(mockContext.labels).toBeDefined();
			expect(Array.isArray(mockContext.labels)).toBe(true);
			expect(mockContext.labels).toContain("bug");
		});

		it("should support optional prompt type", () => {
			expect(mockContext.promptType).toBe("debugger");
			const contextWithoutType: PromptContext = {
				...mockContext,
				promptType: undefined,
			};
			expect(contextWithoutType.promptType).toBeUndefined();
		});

		it("should support session state flags", () => {
			expect(mockContext.isNewSession).toBe(true);
			expect(mockContext.isMentionTriggered).toBe(false);
		});

		it("should support optional attachment manifest", () => {
			expect(mockContext.attachmentManifest).toBeDefined();
			mockContext.attachmentManifest = "Attachment: file.pdf";
			expect(mockContext.attachmentManifest).toBe("Attachment: file.pdf");
		});

		it("should support optional session data", () => {
			expect(mockContext.sessionData).toBeUndefined();
			mockContext.sessionData = { sessionId: "abc123" };
			expect(mockContext.sessionData.sessionId).toBe("abc123");
		});
	});

	describe("Adapter Behavior Expectations", () => {
		it("should handle different prompt types correctly", async () => {
			const promptTypes: Array<"debugger" | "builder" | "scoper"> = [
				"debugger",
				"builder",
				"scoper",
			];

			for (const type of promptTypes) {
				const contextWithType = { ...mockContext, promptType: type };
				await mockAdapter.prepareSystemPrompt(contextWithType);
				expect(mockAdapter.prepareSystemPrompt).toHaveBeenCalledWith(
					contextWithType,
				);
			}
		});

		it("should handle mention-triggered sessions differently", async () => {
			const mentionContext = {
				...mockContext,
				isMentionTriggered: true,
			};
			await mockAdapter.prepareSystemPrompt(mentionContext);
			expect(mockAdapter.prepareSystemPrompt).toHaveBeenCalledWith(
				mentionContext,
			);
		});

		it("should provide appropriate tool restrictions based on context", () => {
			// Test with debugger prompt type (typically read-only)
			mockAdapter.getToolRestrictions = vi.fn().mockReturnValue("readOnly");
			const debuggerResult = mockAdapter.getToolRestrictions({
				...mockContext,
				promptType: "debugger",
			});
			expect(debuggerResult).toBe("readOnly");

			// Test with builder prompt type (typically safe or all)
			mockAdapter.getToolRestrictions = vi.fn().mockReturnValue("safe");
			const builderResult = mockAdapter.getToolRestrictions({
				...mockContext,
				promptType: "builder",
			});
			expect(builderResult).toBe("safe");
		});

		it("should handle errors gracefully", async () => {
			const errorAdapter: PromptSystemAdapter = {
				initialize: vi.fn().mockRejectedValue(new Error("Init failed")),
				prepareSystemPrompt: vi
					.fn()
					.mockRejectedValue(new Error("Prompt failed")),
				prepareUserPrompt: vi
					.fn()
					.mockRejectedValue(new Error("User prompt failed")),
				getToolRestrictions: vi.fn().mockImplementation(() => {
					throw new Error("Tools failed");
				}),
				handleResponse: vi
					.fn()
					.mockRejectedValue(new Error("Response failed")),
			};

			await expect(errorAdapter.initialize(mockConfig)).rejects.toThrow(
				"Init failed",
			);
			await expect(
				errorAdapter.prepareSystemPrompt(mockContext),
			).rejects.toThrow("Prompt failed");
			await expect(
				errorAdapter.prepareUserPrompt(mockIssue, mockContext),
			).rejects.toThrow("User prompt failed");
			expect(() => errorAdapter.getToolRestrictions(mockContext)).toThrow(
				"Tools failed",
			);
			await expect(
				errorAdapter.handleResponse({}, mockContext),
			).rejects.toThrow("Response failed");
		});
	});
});
