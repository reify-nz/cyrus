import type { RepositoryConfig } from "../types.js";
import type { PromptSystemAdapter } from "./PromptSystemAdapter.js";

/**
 * Factory for creating prompt system adapters
 * Manages adapter lifecycle and caching
 */
export class PromptSystemFactory {
	/** Cache of initialized adapters by repository ID */
	private static adapterCache = new Map<string, PromptSystemAdapter>();

	/** Registry of adapter constructors by type */
	private static adapterRegistry = new Map<
		string,
		new () => PromptSystemAdapter
	>();

	/**
	 * Register an adapter type
	 * @param type Adapter type name
	 * @param adapterClass Adapter class constructor
	 */
	static registerAdapter(
		type: string,
		adapterClass: new () => PromptSystemAdapter,
	): void {
		this.adapterRegistry.set(type, adapterClass);
	}

	/**
	 * Create appropriate adapter based on repository configuration
	 * @param repository Repository configuration
	 * @returns Initialized prompt system adapter
	 */
	static async createAdapter(
		repository: RepositoryConfig,
	): Promise<PromptSystemAdapter> {
		// Check cache first
		const cached = this.getCachedAdapter(repository.id);
		if (cached) {
			return cached;
		}

		// Determine adapter type
		const adapterType = repository.promptSystem || "traditional";

		// Get adapter constructor
		const AdapterClass = this.adapterRegistry.get(adapterType);
		if (!AdapterClass) {
			throw new Error(
				`Unknown prompt system type: ${adapterType}. Available types: ${Array.from(
					this.adapterRegistry.keys(),
				).join(", ")}`,
			);
		}

		// Create and initialize adapter
		const adapter = new AdapterClass();
		await adapter.initialize(repository);

		// Cache for future use
		this.adapterCache.set(repository.id, adapter);

		return adapter;
	}

	/**
	 * Get cached adapter for repository
	 * @param repositoryId Repository ID
	 * @returns Cached adapter or null
	 */
	static getCachedAdapter(repositoryId: string): PromptSystemAdapter | null {
		return this.adapterCache.get(repositoryId) || null;
	}

	/**
	 * Clear adapter cache
	 * @param repositoryId Optional repository ID to clear specific cache
	 */
	static clearCache(repositoryId?: string): void {
		if (repositoryId) {
			this.adapterCache.delete(repositoryId);
		} else {
			this.adapterCache.clear();
		}
	}

	/**
	 * Get registered adapter types
	 * @returns Array of registered adapter type names
	 */
	static getRegisteredTypes(): string[] {
		return Array.from(this.adapterRegistry.keys());
	}

	/**
	 * Check if adapter type is registered
	 * @param type Adapter type name
	 * @returns True if type is registered
	 */
	static isRegistered(type: string): boolean {
		return this.adapterRegistry.has(type);
	}
}
