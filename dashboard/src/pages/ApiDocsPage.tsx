import { useState } from 'react'
import openapi from '../../../openapi.json'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface Param {
  name: string
  in: string
  required?: boolean
  schema?: { type?: string; example?: unknown }
}

interface EndpointInfo {
  path: string
  method: HttpMethod
  summary: string
  tags: string[]
  parameters?: Param[]
  requestBody?: unknown
  responses?: Record<string, unknown>
}

const METHOD_COLORS: Record<HttpMethod, { bg: string; color: string; label: string }> = {
  get:    { bg: '#0d3320', color: 'var(--green)',  label: 'GET'    },
  post:   { bg: '#3a2a00', color: 'var(--amber)',  label: 'POST'   },
  put:    { bg: '#1a2540', color: '#60a5fa',       label: 'PUT'    },
  patch:  { bg: '#1a2540', color: '#a78bfa',       label: 'PATCH'  },
  delete: { bg: '#3a0d0a', color: 'var(--red)',    label: 'DELETE' },
}

function collectEndpoints(): EndpointInfo[] {
  const endpoints: EndpointInfo[] = []
  const paths = (openapi as Record<string, unknown>).paths as Record<string, Record<string, unknown>>

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      const operation = op as Record<string, unknown>
      endpoints.push({
        path,
        method: method as HttpMethod,
        summary: (operation.summary as string) || '',
        tags: (operation.tags as string[]) || [],
        parameters: operation.parameters as Param[] | undefined,
        requestBody: operation.requestBody,
        responses: operation.responses as Record<string, unknown> | undefined,
      })
    }
  }
  return endpoints
}

function groupByTag(endpoints: EndpointInfo[]): Record<string, EndpointInfo[]> {
  const groups: Record<string, EndpointInfo[]> = {}
  for (const ep of endpoints) {
    const tag = ep.tags[0] || 'Other'
    if (!groups[tag]) groups[tag] = []
    groups[tag].push(ep)
  }
  return groups
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      padding: '10px 12px',
      fontSize: 11,
      color: 'var(--text)',
      overflow: 'auto',
      borderRadius: 2,
      lineHeight: 1.6,
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function ParamBadge({ location }: { location: string }) {
  const colors: Record<string, string> = {
    path:   'var(--amber)',
    query:  'var(--green)',
    header: '#60a5fa',
    body:   '#a78bfa',
  }
  return (
    <span style={{
      fontSize: 10,
      color: colors[location] || 'var(--text-dim)',
      border: `1px solid ${colors[location] || 'var(--border)'}`,
      padding: '1px 5px',
      letterSpacing: '0.06em',
    }}>
      {location.toUpperCase()}
    </span>
  )
}

function EndpointCard({ ep }: { ep: EndpointInfo }) {
  const [open, setOpen] = useState(false)
  const mc = METHOD_COLORS[ep.method]
  const params = ep.parameters
  const reqBody = ep.requestBody as Record<string, unknown> | undefined
  const schema = reqBody?.content
    ? ((reqBody.content as Record<string, unknown>)['application/json'] as Record<string, unknown>)?.schema
    : undefined

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${mc.color}`,
      marginBottom: 6,
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          background: open ? 'var(--bg-hover)' : 'var(--bg-panel)',
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          padding: '2px 7px',
          background: mc.bg,
          color: mc.color,
          minWidth: 54,
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {mc.label}
        </span>
        <code style={{ fontSize: 12, color: 'var(--text-bright)', flex: 1 }}>{ep.path}</code>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto', paddingLeft: 12 }}>
          {ep.summary}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Parameters */}
          {params != null && params.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>PARAMETERS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {params.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <ParamBadge location={p.in} />
                    <code style={{ color: 'var(--text-bright)' }}>{p.name}</code>
                    {p.required === true ? (
                      <span style={{ fontSize: 10, color: 'var(--red)' }}>required</span>
                    ) : null}
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                      {p.schema?.type}
                      {p.schema?.example !== undefined ? (
                        <span style={{ color: 'var(--border-bright)' }}>
                          {' '}· e.g. {String(p.schema.example)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Request Body */}
          {schema != null ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>REQUEST BODY</div>
              <JsonBlock data={schema} />
            </div>
          ) : null}

          {/* Responses */}
          {ep.responses != null ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8 }}>RESPONSES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(ep.responses).map(([code, resp]) => {
                  const r = resp as Record<string, unknown>
                  const respSchema = r.content
                    ? ((r.content as Record<string, unknown>)['application/json'] as Record<string, unknown>)?.schema
                    : undefined
                  const isOk = code.startsWith('2')
                  const isErr = code.startsWith('4') || code.startsWith('5')
                  return (
                    <div key={code}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isOk ? 'var(--green)' : isErr ? 'var(--red)' : 'var(--text)',
                        }}>
                          {code}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.description as string}</span>
                      </div>
                      {!!respSchema && <JsonBlock data={respSchema} />}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function ApiDocsPage() {
  const endpoints = collectEndpoints()
  const groups = groupByTag(endpoints)
  const [openTags, setOpenTags] = useState<Set<string>>(() => new Set(Object.keys(groups)))
  const info = (openapi as Record<string, unknown>).info as Record<string, string>

  const toggleTag = (tag: string) => {
    setOpenTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="animate-fade-in">
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 4 }}>
          SYSTEM / API DOCS
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-bright)' }}>{info.title}</h1>
        <div style={{ marginTop: 6, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            background: '#0d3320',
            color: 'var(--green)',
            letterSpacing: '0.06em',
          }}>
            OAS {(openapi as unknown as Record<string, string>).openapi}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>v{info.version}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{info.description}</span>
        </div>
      </div>

      {/* Endpoint count summary */}
      <div style={{ display: 'flex', gap: 16 }}>
        {Object.entries(METHOD_COLORS).map(([method, mc]) => {
          const count = endpoints.filter(e => e.method === method).length
          if (!count) return null
          return (
            <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: mc.color, fontWeight: 600 }}>{mc.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{count}</span>
            </div>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
          {endpoints.length} endpoints total
        </span>
      </div>

      {/* Tag groups */}
      {Object.entries(groups).map(([tag, eps]) => (
        <div key={tag}>
          <button
            onClick={() => toggleTag(tag)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              paddingBottom: 8,
              borderBottom: '1px solid var(--border-bright)',
              marginBottom: 10,
              color: 'var(--text-bright)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--amber)', fontSize: 10 }}>▸</span>
            {tag.toUpperCase()}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>{eps.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
              {openTags.has(tag) ? '▲' : '▼'}
            </span>
          </button>
          {openTags.has(tag) && eps.map((ep, i) => <EndpointCard key={i} ep={ep} />)}
        </div>
      ))}
    </div>
  )
}
