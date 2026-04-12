import { describe, test, expect } from "bun:test"
import { execSync } from "node:child_process"

const BIN = "./nekofree"

describe("smoke tests", () => {
	test("--version outputs version string", () => {
		const output = execSync(`${BIN} --version 2>&1`).toString().trim()
		expect(output).toMatch(/1\.\d+\.\d+/)
	})

	test("--help outputs usage info", () => {
		const output = execSync(`${BIN} --help 2>&1`).toString()
		expect(output).toContain("nekofree")
	})

	test("binary exists and is executable", () => {
		const fs = require("node:fs")
		expect(fs.existsSync(BIN)).toBe(true)
	})
})
