export type Attributes = Record<string, string | number | boolean | undefined>

export type Meter = {
  createCounter(name: string, options?: MetricOptions): { add(value: number, attrs?: Attributes): void }
  createHistogram(name: string, options?: MetricOptions): { record(value: number, attrs?: Attributes): void }
  createUpDownCounter(name: string, options?: MetricOptions): { add(value: number, attrs?: Attributes): void }
}

export type MetricOptions = {
  description?: string
  unit?: string
}

export type DiagLogger = {
  error(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
  verbose(message: string, ...args: unknown[]): void
}

export type HrTime = [number, number]

export type ExportResult = {
  code: number
  error?: Error
}

export const ExportResultCode = { SUCCESS: 0, FAILED: 1 } as const

export type LoggerProvider = {
  getLogger(name: string, version?: string): unknown
  shutdown(): Promise<void>
  forceFlush(): Promise<void>
}

export type MeterProvider = {
  getMeter(name: string, version?: string): Meter
  shutdown(): Promise<void>
  forceFlush(): Promise<void>
}

export type BasicTracerProvider = {
  getTracer(name: string, version?: string): unknown
  shutdown(): Promise<void>
  forceFlush(): Promise<void>
}

export type Logger = {
  emit(record: unknown): void
}

export type _LogsNamespace = { getLogger(name: string, version?: string): Logger }

export const logs: _LogsNamespace = { getLogger() { return null as unknown as Logger } }

export type PushMetricExporter = {
  export(metrics: unknown, resultCallback: (result: ExportResult) => void): Promise<void>
  shutdown(): Promise<void>
  forceFlush(): Promise<void>
}

export type DataPoint<T> = {
  value: T
  attributes: Attributes
  startTime: HrTime
  endTime: HrTime
}

export type MetricData = {
  descriptor: { name: string; description: string; unit: string }
  dataPoints: DataPoint<number>[]
}

export type ResourceMetrics = {
  resource: { attributes: Attributes }
  scopeMetrics: Array<{ metrics: MetricData[] }>
}

export type AggregationTemporality = 0 | 1
export const AggregationTemporality = { DELTA: 0 as AggregationTemporality, CUMULATIVE: 1 as AggregationTemporality }
