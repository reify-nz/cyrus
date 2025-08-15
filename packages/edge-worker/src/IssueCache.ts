import type { Issue as LinearIssue } from "@linear/sdk";

export interface CachedIssue {
	issue: LinearIssue;
	timestamp: number;
	ttl: number;
	accessCount: number;
	lastAccessed: number;
}

/**
 * Smart cache for Linear issues with TTL and fallback support
 */
export class IssueCache {
	private cache: Map<string, CachedIssue> = new Map();
	private readonly DEFAULT_TTL = 600000; // 10 minutes default TTL
	private readonly EXTENDED_TTL = 1800000; // 30 minutes for frequently accessed issues
	private readonly STALE_TTL = 3600000; // 1 hour - maximum time to keep stale data
	private readonly MAX_CACHE_SIZE = 100; // Maximum number of issues to cache
	
	/**
	 * Get an issue from cache
	 * @param issueId The issue ID
	 * @param allowStale Whether to return stale data if fresh data is not available
	 */
	get(issueId: string, allowStale = false): LinearIssue | null {
		const cached = this.cache.get(issueId);
		if (!cached) {
			return null;
		}
		
		const now = Date.now();
		const age = now - cached.timestamp;
		
		// Update access tracking
		cached.accessCount++;
		cached.lastAccessed = now;
		
		// Check if data is fresh
		if (age <= cached.ttl) {
			console.log(`[IssueCache] Cache hit for issue ${issueId} (age: ${age}ms)`);
			return cached.issue;
		}
		
		// Check if we can return stale data
		if (allowStale && age <= this.STALE_TTL) {
			console.log(`[IssueCache] Returning stale data for issue ${issueId} (age: ${age}ms)`);
			return cached.issue;
		}
		
		// Data is too old
		console.log(`[IssueCache] Cache miss for issue ${issueId} (expired)`);
		return null;
	}
	
	/**
	 * Store an issue in cache
	 */
	set(issueId: string, issue: LinearIssue): void {
		const existing = this.cache.get(issueId);
		const now = Date.now();
		
		// Determine TTL based on access patterns
		let ttl = this.DEFAULT_TTL;
		if (existing && existing.accessCount > 5) {
			// Frequently accessed issues get longer TTL
			ttl = this.EXTENDED_TTL;
		}
		
		// Store the issue
		this.cache.set(issueId, {
			issue,
			timestamp: now,
			ttl,
			accessCount: existing?.accessCount || 0,
			lastAccessed: now
		});
		
		console.log(`[IssueCache] Cached issue ${issueId} with TTL ${ttl}ms`);
		
		// Enforce cache size limit
		this.evictIfNeeded();
	}
	
	/**
	 * Invalidate cache entry
	 */
	invalidate(issueId: string): void {
		if (this.cache.delete(issueId)) {
			console.log(`[IssueCache] Invalidated cache for issue ${issueId}`);
		}
	}
	
	/**
	 * Invalidate all cache entries
	 */
	invalidateAll(): void {
		const size = this.cache.size;
		this.cache.clear();
		console.log(`[IssueCache] Cleared ${size} cached issues`);
	}
	
	/**
	 * Warm the cache with frequently accessed issues
	 * @param issues Array of issues to pre-cache
	 */
	warm(issues: LinearIssue[]): void {
		for (const issue of issues) {
			if (issue.id) {
				this.set(issue.id, issue);
			}
		}
		console.log(`[IssueCache] Warmed cache with ${issues.length} issues`);
	}
	
	/**
	 * Get cache statistics
	 */
	getStats(): {
		size: number;
		freshCount: number;
		staleCount: number;
		totalAccessCount: number;
		mostAccessed: { issueId: string; count: number } | null;
	} {
		const now = Date.now();
		let freshCount = 0;
		let staleCount = 0;
		let totalAccessCount = 0;
		let mostAccessed: { issueId: string; count: number } | null = null;
		
		for (const [issueId, cached] of this.cache.entries()) {
			const age = now - cached.timestamp;
			if (age <= cached.ttl) {
				freshCount++;
			} else if (age <= this.STALE_TTL) {
				staleCount++;
			}
			
			totalAccessCount += cached.accessCount;
			
			if (!mostAccessed || cached.accessCount > mostAccessed.count) {
				mostAccessed = { issueId, count: cached.accessCount };
			}
		}
		
		return {
			size: this.cache.size,
			freshCount,
			staleCount,
			totalAccessCount,
			mostAccessed
		};
	}
	
	/**
	 * Evict least recently used items if cache is too large
	 */
	private evictIfNeeded(): void {
		if (this.cache.size <= this.MAX_CACHE_SIZE) {
			return;
		}
		
		// Sort by last accessed time
		const entries = Array.from(this.cache.entries())
			.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
		
		// Remove oldest entries
		const toRemove = this.cache.size - this.MAX_CACHE_SIZE + 10; // Remove 10 extra to avoid frequent eviction
		for (let i = 0; i < toRemove && i < entries.length; i++) {
			const entry = entries[i];
			if (entry) {
				this.cache.delete(entry[0]);
			}
		}
		
		console.log(`[IssueCache] Evicted ${toRemove} least recently used items`);
	}
	
	/**
	 * Check if an issue needs refreshing
	 */
	needsRefresh(issueId: string): boolean {
		const cached = this.cache.get(issueId);
		if (!cached) {
			return true;
		}
		
		const age = Date.now() - cached.timestamp;
		return age > cached.ttl;
	}
	
	/**
	 * Update TTL for an issue based on access patterns
	 */
	updateTTL(issueId: string): void {
		const cached = this.cache.get(issueId);
		if (!cached) {
			return;
		}
		
		// Extend TTL for frequently accessed issues
		if (cached.accessCount > 10) {
			cached.ttl = this.EXTENDED_TTL;
			console.log(`[IssueCache] Extended TTL for frequently accessed issue ${issueId}`);
		}
	}
}
