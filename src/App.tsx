import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import BboxOverlay from './components/BboxOverlay'
import {
  PLATFORM_ACCENTS,
  PLATFORM_LABELS,
  SAMPLE_OUTFITS,
} from './constants'
import { analyzeOutfit, getDemoAnalysis, matchOutfit } from './geminiService'
import type { MatchResult, OutfitAnalysis, PlatformId, SampleOutfit } from './types'

const initialDemo = getDemoAnalysis()
const initialActiveTabs: Record<string, PlatformId> = Object.fromEntries(
  initialDemo.items.map((item) => [item.id, item.bestPlatform]),
)

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewImgRef = useRef<HTMLImageElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string>(SAMPLE_OUTFITS[0].dataUrl)
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(initialDemo)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTabs, setActiveTabs] =
    useState<Record<string, PlatformId>>(initialActiveTabs)
  const [isDemo, setIsDemo] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  const totalItems = analysis?.items.length ?? 0
  const cheapestTotal = useMemo(
    () =>
      analysis?.items.reduce((sum, item) => {
        const bestDeal = item.platforms.find(
          (deal) => deal.platform === item.bestPlatform,
        )
        return sum + (bestDeal?.estimatedPricePhp ?? 0)
      }, 0) ?? 0,
    [analysis],
  )

  const runAnalysis = async (file: File, fallbackPreview?: string) => {
    if (!file.type.startsWith('image/')) {
      setError('Image lang muna, bestie. Upload JPG, PNG, WEBP, or SVG.')
      return
    }

    setPreviewUrl(fallbackPreview ?? URL.createObjectURL(file))
    setIsLoading(true)
    setError(null)
    setAnalysis(null)
    setMatchResult(null)
    setIsDemo(false)
    setHasStarted(true)

    try {
      const response = await matchOutfit(file)
      setAnalysis(response.analysis)
      setMatchResult(response.match)
      setActiveTabs(
        Object.fromEntries(response.analysis.items.map((item) => [item.id, item.bestPlatform])),
      )
    } catch {
      try {
        const result = await analyzeOutfit(file)
        setAnalysis(result)
        setMatchResult(null)
        setActiveTabs(
          Object.fromEntries(result.items.map((item) => [item.id, item.bestPlatform])),
        )
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'May sumablay sa analysis. Try ulit with a clearer fit pic.'
        const demo = getDemoAnalysis()

        setError(`${message} Showing safe demo output muna.`)
        setAnalysis(demo)
        setMatchResult(null)
        setActiveTabs(
          Object.fromEntries(demo.items.map((item) => [item.id, item.bestPlatform])),
        )
        setIsDemo(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) {
      void runAnalysis(file)
    }
  }

  const loadSample = async (sample: SampleOutfit) => {
    const response = await fetch(sample.dataUrl)
    const blob = await response.blob()
    const file = new File([blob], `${sample.name.toLowerCase().replaceAll(' ', '-')}.svg`, {
      type: 'image/svg+xml',
    })

    void runAnalysis(file, sample.dataUrl)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href="#top" aria-label="Drip Check home">
            <span className="wordmark-mark" aria-hidden="true">
              ✶
            </span>
            <span className="wordmark-text">DRIP CHECK</span>
          </a>
          <nav className="topbar-meta" aria-label="About this build">
            <span className="topbar-chip">Manila · 2026</span>
          </nav>
        </div>
      </header>

      <main
        className={`app-shell ${hasStarted ? 'app-shell--focused' : ''}`}
        id="top"
      >
        <section className="hero">
          <div className="hero-text">
            <span className="eyebrow">Hyper-local fashion agent</span>
            <h1>
              Sino mas <em>tipid</em>?
              <br />
              Drip Check finds out.
            </h1>
            <p className="hero-copy">
              Upload a fit pic. Gemini identifies every clothing item, writes
              PH-ready search queries for Shopee, Lazada, and ukay, then
              compares prices and calls one Best Buy per item.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isLoading ? 'Checking the fit...' : 'Upload your drip →'}
              </button>
              <span className="helper-text">
                Or load a demo fit · Walang sign-in needed
              </span>
            </div>
          </div>

          <aside className="hero-meta" aria-label="Live agent stats">
            <div className="meta-row">
              <span className="meta-label">Items found</span>
              <strong>{totalItems}</strong>
            </div>
            <div className="meta-row meta-row-accent">
              <span className="meta-label">Best-value total</span>
              <strong>₱{cheapestTotal.toLocaleString('en-PH')}</strong>
            </div>
            <ol className="hero-flow">
              <li>Detect items</li>
              <li>Write PH queries</li>
              <li>Compare prices</li>
              <li>Recommend Best Buy</li>
            </ol>
          </aside>
        </section>

        <section className="workspace">
          <article className="upload-card">
            <header className="card-header">
              <span className="step-tag">01 · Upload</span>
              <h2>Drop your outfit photo</h2>
              <p>Real fit pic, screenshot, or one of the safe demo fits.</p>
            </header>

            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => handleFiles(event.target.files)}
            />

            <button
              type="button"
              className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
              disabled={isLoading}
              aria-label="Upload outfit photo"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                handleFiles(event.dataTransfer.files)
              }}
            >
              <img
                ref={previewImgRef}
                src={previewUrl}
                alt="Uploaded outfit preview"
              />
              <BboxOverlay
                items={analysis?.items ?? []}
                imgRef={previewImgRef}
                visible={!isLoading && !!analysis}
              />
              <span className="dropzone-cta">
                {isDragging ? 'Bitawan mo na dito' : 'Drag-drop or tap to upload'}
              </span>
            </button>

            <div className="sample-row" aria-label="Sample outfits">
              {SAMPLE_OUTFITS.map((sample) => (
                <button
                  type="button"
                  key={sample.name}
                  disabled={isLoading}
                  onClick={() => void loadSample(sample)}
                >
                  <span className="sample-name">{sample.name}</span>
                  <span className="sample-caption">{sample.caption}</span>
                  <span className="sample-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </article>

          <aside className="status-card">
            <header className="card-header">
              <span className="step-tag step-tag-accent">02 · Agent thinks</span>
              <h2>Analyze → Search → Compare → Pick</h2>
              <p>The model behaves like a shopping agent, not a captioner.</p>
            </header>

            <div className="status-live" aria-live="polite">
              {isLoading && (
                <div className="loading-pill" role="status">
                  <span className="loader-dot" aria-hidden="true" />
                  Analyzing your drip...
                </div>
              )}
              {error && <p className="error-box">{error}</p>}
              {!isLoading && !error && isDemo && (
                <p className="info-box">
                  Showing safe demo output. Upload a fit to see live Gemini results.
                </p>
              )}
            </div>

            {analysis && (
              <div className="vibe-card">
                <span className="vibe-label">Vibe</span>
                <strong>{analysis.vibe}</strong>
                <p>{analysis.summary}</p>
                <small>
                  <span className="tipid-tag">Tipid tip</span>
                  {analysis.tipidTip}
                </small>
              </div>
            )}

            {matchResult && !isDemo && (
              <div className="vibe-card" style={{ marginTop: '0.75rem' }}>
                <span className="vibe-label">
                  {matchResult.confidenceLevel === 'high'
                    ? 'Match Found'
                    : matchResult.confidenceLevel === 'medium'
                      ? 'Possible Matches'
                      : 'No Confident Match'}
                </span>
                {matchResult.confidenceLevel === 'high' && matchResult.topMatch && (
                  <strong>
                    {matchResult.topMatch.lookName} — {Math.round(matchResult.topMatch.matchScore * 100)}% match
                  </strong>
                )}
                {matchResult.confidenceLevel === 'medium' && (
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                    {matchResult.candidates.map((c) => (
                      <li key={c.lookId}>
                        <strong>{c.lookName}</strong> — {Math.round(c.matchScore * 100)}%
                      </li>
                    ))}
                  </ul>
                )}
                {matchResult.confidenceLevel === 'low' && (
                  <p style={{ opacity: 0.7 }}>
                    This outfit didn't closely match any look in the catalog. Try a clearer photo or a different angle.
                  </p>
                )}
                {matchResult.topMatch && matchResult.topMatch.explanations.length > 0 && (
                  <small style={{ display: 'block', marginTop: '0.25rem', opacity: 0.6 }}>
                    {matchResult.topMatch.explanations.join(' · ')}
                  </small>
                )}
              </div>
            )}
          </aside>
        </section>

        {analysis && (
          <section className="results">
            <header className="section-header">
              <span className="step-tag">03 · Best buys</span>
              <h2>Ready-to-click shopping links</h2>
              <p>
                Each card compares Shopee, Lazada, and Ukay/Carousell, then
                highlights the cheapest path per item.
              </p>
            </header>

            <div className="item-grid">
              {analysis.items.map((item) => {
                const selectedPlatform = activeTabs[item.id] ?? item.bestPlatform
                const selectedDeal =
                  item.platforms.find((deal) => deal.platform === selectedPlatform) ??
                  item.platforms[0]

                return (
                  <article className="item-card" key={item.id}>
                    <header className="item-card-header">
                      <span className="category-pill">{item.category}</span>
                      <span className="confidence">
                        {Math.round(item.confidence * 100)}% sure
                      </span>
                    </header>

                    <h3>{item.itemName}</h3>
                    <p className="item-meta">
                      {item.color} · {item.style} · {item.materialHint}
                    </p>

                    <p className="budget-note">{item.budgetNote}</p>

                    <div
                      className="tabs"
                      role="tablist"
                      aria-label={`${item.itemName} shops`}
                    >
                      {item.platforms.map((deal) => (
                        <button
                          type="button"
                          key={deal.platform}
                          role="tab"
                          aria-selected={deal.platform === selectedPlatform}
                          className={
                            deal.platform === selectedPlatform ? 'active' : ''
                          }
                          style={
                            {
                              '--accent': PLATFORM_ACCENTS[deal.platform],
                            } as CSSProperties
                          }
                          onClick={() =>
                            setActiveTabs((current) => ({
                              ...current,
                              [item.id]: deal.platform,
                            }))
                          }
                        >
                          <span>{PLATFORM_LABELS[deal.platform]}</span>
                          {deal.platform === item.bestPlatform && (
                            <span className="best-badge">Best</span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="deal-card">
                      <span className="deal-label">Search query</span>
                      <strong className="deal-query">{selectedDeal.query}</strong>
                      <div className="price-row">
                        <span className="deal-price">
                          ₱{selectedDeal.estimatedPricePhp.toLocaleString('en-PH')}
                          <small>est.</small>
                        </span>
                        <a
                          className="deal-link"
                          href={selectedDeal.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${PLATFORM_LABELS[selectedDeal.platform]} search for ${selectedDeal.query}`}
                        >
                          Open {PLATFORM_LABELS[selectedDeal.platform]} →
                        </a>
                      </div>
                      <p className="deal-reason">{selectedDeal.reason}</p>
                    </div>

                    <footer className="best-buy">
                      <span className="best-buy-label">Best Buy</span>
                      <strong>{PLATFORM_LABELS[item.bestPlatform]}</strong>
                      <span className="best-buy-reason">{item.bestBuyReason}</span>
                    </footer>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <footer className="page-footer">
          <span>
            Drip Check · A Filipino fashion finder demo for GDG Manila Build
            with AI 2026.
          </span>
          <span>
            No real-time prices. Estimates only. Hanapin pa rin ang totoong sale.
          </span>
        </footer>
      </main>
    </>
  )
}

export default App
