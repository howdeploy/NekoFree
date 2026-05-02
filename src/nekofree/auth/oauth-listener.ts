/**
 * Minimal localhost OAuth callback listener.
 *
 * Spins up a temporary HTTP server on localhost, captures the
 * authorization code from the redirect, then shuts down.
 */

import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

export class OAuthListener {
	private server: Server
	private port = 0
	private resolver: ((code: string) => void) | null = null
	private rejecter: ((err: Error) => void) | null = null
	private expectedState: string | null = null

	constructor() {
		this.server = createServer()
	}

	async start(): Promise<number> {
		return new Promise((resolve, reject) => {
			this.server.once("error", (err) => {
				reject(new Error(`OAuth listener failed: ${err.message}`))
			})
			this.server.listen(0, "127.0.0.1", () => {
				const addr = this.server.address() as AddressInfo
				this.port = addr.port
				resolve(this.port)
			})
		})
	}

	waitForCode(state: string): Promise<string> {
		return new Promise((resolve, reject) => {
			this.resolver = resolve
			this.rejecter = reject
			this.expectedState = state
			this.server.on("request", (req, res) => {
				this.handleRequest(req, res)
			})
		})
	}

	private handleRequest(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): void {
		const url = new URL(req.url || "/", `http://localhost:${this.port}`)
		if (url.pathname !== "/callback") {
			res.writeHead(404)
			res.end("Not found")
			return
		}

		const code = url.searchParams.get("code")
		const receivedState = url.searchParams.get("state")

		if (!code) {
			res.writeHead(400)
			res.end("Missing authorization code")
			this.reject(new Error("No authorization code received"))
			return
		}

		if (receivedState !== this.expectedState) {
			res.writeHead(400)
			res.end("Invalid state")
			this.reject(new Error("Invalid state parameter"))
			return
		}

		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
		res.end(`
			<html><body>
			<h1>✓ Авторизация завершена</h1>
			<p>Можно закрыть эту вкладку и вернуться в терминал.</p>
			</body></html>
		`)

		this.resolve(code)
	}

	private resolve(code: string): void {
		if (this.resolver) {
			this.resolver(code)
			this.cleanup()
		}
	}

	private reject(err: Error): void {
		if (this.rejecter) {
			this.rejecter(err)
			this.cleanup()
		}
	}

	private cleanup(): void {
		this.resolver = null
		this.rejecter = null
	}

	close(): void {
		this.server.removeAllListeners()
		this.server.close()
	}
}
