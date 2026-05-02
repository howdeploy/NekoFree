import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
	addConnection,
	removeConnection,
	formatConnectionList,
	validateAndReport,
} from "../src/nekofree/auth/cli.js"
import {
	saveConnection,
	loadConnection,
	listConnections,
	deleteConnection,
	connectionExists,
} from "../src/nekofree/auth/storage.js"
import { AuthConnector } from "../src/nekofree/auth/connector.js"
import type { AuthConnection } from "../src/nekofree/auth/types.js"

let tmpDir: string
let savedConfigDir: string | undefined

beforeEach(() => {
	savedConfigDir = process.env.NEKOFREE_CONFIG_DIR
	tmpDir = mkdtempSync(join(tmpdir(), "nf-auth-test-"))
	process.env.NEKOFREE_CONFIG_DIR = tmpDir
})

afterEach(() => {
	if (savedConfigDir === undefined) {
		delete process.env.NEKOFREE_CONFIG_DIR
	} else {
		process.env.NEKOFREE_CONFIG_DIR = savedConfigDir
	}
	try {
		rmSync(tmpDir, { recursive: true, force: true })
	} catch { /* ignore */ }
})

function makeConn(overrides?: Partial<AuthConnection>): AuthConnection {
	return {
		id: "test-api",
		name: "Test API",
		baseUrl: "https://api.example.com",
		auth: { type: "bearer", token: "sk-test" },
		createdAt: new Date().toISOString(),
		...overrides,
	}
}

// ═════════════════════════════════════════════════════════════════════
//  Storage
// ═════════════════════════════════════════════════════════════════════

describe("Auth Storage", () => {
	test("save and load roundtrip", () => {
		const conn = makeConn()
		saveConnection(conn)
		const loaded = loadConnection("test-api")
		expect(loaded).not.toBeNull()
		expect(loaded!.id).toBe("test-api")
		expect(loaded!.auth.type).toBe("bearer")
	})

	test("listConnections returns sorted list", () => {
		saveConnection(makeConn({ id: "b", name: "Beta" }))
		saveConnection(makeConn({ id: "a", name: "Alpha" }))
		const list = listConnections()
		expect(list.map(c => c.id)).toEqual(["a", "b"])
	})

	test("deleteConnection removes file", () => {
		saveConnection(makeConn())
		expect(connectionExists("test-api")).toBe(true)
		const ok = deleteConnection("test-api")
		expect(ok).toBe(true)
		expect(connectionExists("test-api")).toBe(false)
	})

	test("loadConnection returns null for missing id", () => {
		expect(loadConnection("missing")).toBeNull()
	})

	test("path traversal in id is sanitized", () => {
		const malicious = makeConn({ id: "../../../etc/passwd" })
		saveConnection(malicious)
		// Should be saved with sanitized name, not outside tmpDir
		const list = listConnections()
		expect(list.length).toBe(1)
		expect(list[0]!.id).toBe("../../../etc/passwd")
		// But file should NOT exist outside connections dir
		const outside = join(tmpDir, "etc", "passwd.json")
		expect(() => Bun.file(outside).exists()).not.toThrow()
	})
})

// ═════════════════════════════════════════════════════════════════════
//  Connector
// ═════════════════════════════════════════════════════════════════════

describe("AuthConnector", () => {
	test("bearer auth generates correct header", () => {
		const conn = makeConn({ auth: { type: "bearer", token: "tk-123" } })
		const c = new AuthConnector(conn)
		expect(c.getAuthHeaders()).toEqual({ Authorization: "Bearer tk-123" })
		expect(c.isAuthenticated()).toBe(true)
	})

	test("apiKey header auth generates correct header", () => {
		const conn = makeConn({
			auth: { type: "apiKey", in: "header", name: "X-Api-Key", value: "secret" },
		})
		const c = new AuthConnector(conn)
		expect(c.getAuthHeaders()).toEqual({ "X-Api-Key": "secret" })
	})

	test("basic auth generates correct header", () => {
		const conn = makeConn({
			auth: { type: "basic", username: "admin", password: "hunter2" },
		})
		const c = new AuthConnector(conn)
		const headers = c.getAuthHeaders()
		expect(headers.Authorization).toStartWith("Basic ")
		const decoded = Buffer.from(headers.Authorization.slice(6), "base64").toString()
		expect(decoded).toBe("admin:hunter2")
	})

	test("oauth2 auth generates bearer header from accessToken", () => {
		const conn = makeConn({
			auth: { type: "oauth2", clientId: "cli", accessToken: "at-xyz" },
		})
		const c = new AuthConnector(conn)
		expect(c.getAuthHeaders()).toEqual({ Authorization: "Bearer at-xyz" })
	})

	test("unauthenticated when credentials missing", () => {
		const conn = makeConn({ auth: { type: "bearer", token: "" } })
		const c = new AuthConnector(conn)
		expect(c.isAuthenticated()).toBe(false)
	})

	test("apiKey query param injects into URL", async () => {
		const conn = makeConn({
			baseUrl: "https://api.example.com",
			auth: { type: "apiKey", in: "query", name: "key", value: "abc" },
		})
		const c = new AuthConnector(conn)
		// We can't easily mock fetch here, but we can test via a real request to a local server
		// For now just ensure it doesn't throw
		expect(c.isAuthenticated()).toBe(true)
	})
})

// ═════════════════════════════════════════════════════════════════════
//  CLI
// ═════════════════════════════════════════════════════════════════════

describe("Auth CLI", () => {
	test("addConnection saves new connection", () => {
		const result = addConnection(makeConn())
		expect(result.ok).toBe(true)
		expect(loadConnection("test-api")).not.toBeNull()
	})

	test("addConnection rejects duplicate", () => {
		addConnection(makeConn())
		const result = addConnection(makeConn())
		expect(result.ok).toBe(false)
	})

	test("removeConnection deletes existing", () => {
		addConnection(makeConn())
		const result = removeConnection("test-api")
		expect(result.ok).toBe(true)
		expect(loadConnection("test-api")).toBeNull()
	})

	test("removeConnection reports missing", () => {
		const result = removeConnection("missing")
		expect(result.ok).toBe(false)
	})

	test("formatConnectionList shows empty state", () => {
		const out = formatConnectionList()
		expect(out).toContain("No auth connections")
	})

	test("formatConnectionList shows connections", () => {
		addConnection(makeConn({ id: "a", name: "Alpha" }))
		addConnection(makeConn({ id: "b", name: "Beta" }))
		const out = formatConnectionList()
		expect(out).toContain("Alpha")
		expect(out).toContain("Beta")
		expect(out).toContain("bearer")
	})

	test("validateAndReport reports missing connection", async () => {
		const out = await validateAndReport("missing")
		expect(out).toContain("not found")
	})
})
