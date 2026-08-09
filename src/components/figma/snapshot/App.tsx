import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mapPersistedCards, type PersistedCard, type StudyCard } from '@/lib/card-mappers'

type Card = StudyCard

const PALETTE = [
  '#4ade80', '#fb923c', '#60a5fa', '#e879f9',
  '#facc15', '#34d399', '#f472b6', '#a78bfa',
  '#38bdf8', '#f87171', '#86efac', '#fbbf24',
]

function categoryColor(cat: string, allCats: string[]): string {
  const idx = allCats.indexOf(cat)
  return PALETTE[idx % PALETTE.length] ?? '#a78bfa'
}

function formatDueLabel(dueAt: string | null | undefined): string {
  if (!dueAt) return 'Due now'

  const dueMs = new Date(dueAt).getTime()
  const nowMs = Date.now()
  if (Number.isNaN(dueMs) || dueMs <= nowMs) return 'Due now'

  const diffMs = dueMs - nowMs
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000))
  if (diffHours < 24) {
    return `Due in ${diffHours}h`
  }

  const diffDays = Math.ceil(diffHours / 24)
  return `Due in ${diffDays}d`
}

function formatReviewedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface CardStats { correct: number; incorrect: number }

type View = 'select' | 'study' | 'manage' | 'create' | 'card-detail'
const FLIP_DURATION_MS = 500

interface AppProps {
  initialView?: View
  initialCardId?: number
}

export default function App({ initialView = 'select', initialCardId }: AppProps) {
  const router = useRouter()
  const [deck, setDeck] = useState<Card[]>([])
  const [view, setView] = useState<View>(initialView)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [isTransitioningCard, setIsTransitioningCard] = useState(false)
  const [stats, setStats] = useState<Record<number, CardStats>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [dueReferenceMs, setDueReferenceMs] = useState(0)

  // Selected categories: null = all
  const [selectedCats, setSelectedCats] = useState<Set<string> | null>(null)
  // Staging selection on the select screen before committing
  const [stagingCats, setStagingCats] = useState<Set<string> | null>(null)
  const [sessionCardIds, setSessionCardIds] = useState<number[]>([])

  // Create / edit form
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [formCategory, setFormCategory] = useState('Custom')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [detailCardId] = useState<number | null>(initialCardId ?? null)
  const [createReturnView, setCreateReturnView] = useState<View>('manage')

  const redirectToLogin = useCallback(() => {
    router.push('/login')
    router.refresh()
  }, [router])

  const handleUnauthorized = useCallback((response: Response): boolean => {
    if (response.status === 401) {
      redirectToLogin()
      return true
    }

    return false
  }, [redirectToLogin])

  const refreshDeck = useCallback(async () => {
    const response = await fetch('/api/cards', { cache: 'no-store' })
    if (handleUnauthorized(response)) {
      return
    }

    if (!response.ok) {
      throw new Error('Failed to load cards.')
    }

    const cards = (await response.json()) as PersistedCard[]
    setDueReferenceMs(Date.now())
    setDeck(mapPersistedCards(cards))
    setStats(
      cards.reduce<Record<number, CardStats>>((acc, c) => {
        if (c.stat) {
          acc[c.id] = { correct: c.stat.correct, incorrect: c.stat.incorrect }
        }
        return acc
      }, {})
    )
  }, [handleUnauthorized])

  const recordResult = async (id: number, correct: boolean) => {
    const response = await fetch('/api/stats/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: id, correct }),
    })

    if (handleUnauthorized(response)) {
      return
    }

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      stat: {
        cardId: number
        correct: number
        incorrect: number
        dueAt: string | null
        srsIntervalDays: number
        srsEase: number
        srsRepetitions: number
      }
      review: {
        id: number
        wasCorrect: boolean
        reviewedAt: string
        srsIntervalDays: number
        srsRepetitions: number
        dueAt: string | null
      }
    }
    const stat = payload.stat
    setStats(prev => ({
      ...prev,
      [stat.cardId]: { correct: stat.correct, incorrect: stat.incorrect },
    }))

    setDeck(prev =>
      prev.map(c =>
        c.id === stat.cardId
          ? {
              ...c,
              stat: {
                correct: stat.correct,
                incorrect: stat.incorrect,
                dueAt: stat.dueAt,
                srsIntervalDays: stat.srsIntervalDays,
                srsEase: stat.srsEase,
                srsRepetitions: stat.srsRepetitions,
              },
              reviews: [payload.review, ...(c.reviews ?? [])].slice(0, 25),
            }
          : c
      )
    )
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        await refreshDeck()
      } catch {
        if (!cancelled) {
          setDeck([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshDeck])

  const allCategories = useMemo(
    () => Array.from(new Set(deck.map(c => c.category))).sort(),
    [deck]
  )

  const dueCards = useMemo(() => {
    return deck.filter(c => {
      if (!c.stat?.dueAt) return true
      return new Date(c.stat.dueAt).getTime() <= dueReferenceMs
    })
  }, [deck, dueReferenceMs])

  const activeCards = useMemo(() => {
    if (view === 'study') {
      const byId = new Map(deck.map(c => [c.id, c] as const))
      return sessionCardIds
        .map(id => byId.get(id))
        .filter((c): c is Card => c !== undefined)
    }

    if (!selectedCats) return dueCards
    return dueCards.filter(c => selectedCats.has(c.category))
  }, [view, sessionCardIds, deck, dueCards, selectedCats])

  const card = activeCards[index] as Card | undefined

  const navigate = (dir: 'prev' | 'next') => {
    setIndex(i => dir === 'next' ? Math.min(i + 1, activeCards.length - 1) : Math.max(i - 1, 0))
    setFlipped(false)
  }

  const markKnown = () => {
    if (!card || isTransitioningCard) return

    const currentCardId = card.id
    const wasLastCard = index >= activeCards.length - 1
    setIsTransitioningCard(true)
    setFlipped(false)
    window.setTimeout(() => {
      if (wasLastCard) {
        setSessionCardIds([])
        setIndex(0)
        setFlipped(false)
        setStagingCats(selectedCats ? new Set(selectedCats) : null)
        setView('select')
        setIsTransitioningCard(false)
        return
      }

      setIndex(i => Math.min(i + 1, activeCards.length - 1))
      setIsTransitioningCard(false)
    }, FLIP_DURATION_MS)

    void recordResult(currentCardId, true)
  }

  const markSkip = () => {
    if (!card || isTransitioningCard) return

    const currentCardId = card.id
    const wasLastCard = index >= activeCards.length - 1
    setIsTransitioningCard(true)
    setFlipped(false)
    window.setTimeout(() => {
      if (wasLastCard) {
        setSessionCardIds([])
        setIndex(0)
        setFlipped(false)
        setStagingCats(selectedCats ? new Set(selectedCats) : null)
        setView('select')
        setIsTransitioningCard(false)
        return
      }

      setIndex(i => Math.min(i + 1, activeCards.length - 1))
      setIsTransitioningCard(false)
    }, FLIP_DURATION_MS)

    void recordResult(currentCardId, false)
  }

  const toggleStaging = (cat: string) => {
    setStagingCats(prev => {
      const current = prev ?? new Set(allCategories)
      const next = new Set(current)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
        if (next.size === allCategories.length) return null
      }
      return next.size === 0 ? new Set([cat]) : next
    })
  }

  const stagingAll = () => setStagingCats(null)

  const startReview = () => {
    const sessionCards = !stagingCats
      ? dueCards
      : dueCards.filter(c => stagingCats.has(c.category))

    setDueReferenceMs(Date.now())
    setSelectedCats(stagingCats)
    setSessionCardIds(sessionCards.map(c => c.id))
    setIndex(0)
    setFlipped(false)
    // stats intentionally preserved across sessions
    setView('study')
  }

  const isStagingActive = (cat: string) => !stagingCats || stagingCats.has(cat)
  const stagingCount = stagingCats
    ? dueCards.filter(c => stagingCats.has(c.category)).length
    : dueCards.length

  const openCreate = () => {
    setFront('')
    setBack('')
    setFormCategory(allCategories[0] ?? 'Custom')
    setEditingId(null)
    setCreateReturnView(view)
    setView('create')
  }

  const openEdit = (c: Card) => {
    setFront(c.front)
    setBack(c.back)
    setFormCategory(c.category)
    setEditingId(c.id)
    setCreateReturnView(view)
    setView('create')
  }

  const cancelCreateOrEdit = () => {
    setView(createReturnView)
  }

  const saveCard = async () => {
    if (!front.trim() || !back.trim()) return
    const payload = {
      front: front.trim(),
      back: back.trim(),
      category: formCategory,
    }

    if (editingId !== null) {
      const response = await fetch(`/api/cards/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (handleUnauthorized(response) || !response.ok) {
        return
      }
    } else {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (handleUnauthorized(response) || !response.ok) {
        return
      }
    }

    await refreshDeck()
    if (editingId !== null) {
      setView(createReturnView)
      return
    }

    setView('manage')
  }

  const deleteCard = async (id: number) => {
    const response = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
    if (handleUnauthorized(response) || !response.ok) {
      return
    }

    await refreshDeck()
    setIndex(i => Math.max(0, Math.min(i, activeCards.length - 2)))
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    redirectToLogin()
  }

  const isLast = index === activeCards.length - 1

  const inputStyle = {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #e8e0d0',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 15,
    color: '#1a1035',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    resize: 'vertical' as const,
    boxShadow: '0 1px 3px rgba(26,16,53,0.04)',
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }} className="min-h-screen w-full flex flex-col">
      <div className="fixed inset-0 -z-10" style={{ background: '#f5f0e8' }} />

      {/* Header */}
      <header className="px-8 pt-8 pb-4 flex items-center justify-between w-full">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase mb-0.5" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Study Deck</p>
          <h1 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-display)', color: '#1a1035', fontWeight: 400 }}>Flash Cards</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/study')} className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ background: view === 'select' || view === 'study' ? '#1a1035' : '#ffffff', color: view === 'select' || view === 'study' ? '#f0eaff' : '#8b7355', border: '1px solid #e8e0d0', cursor: 'pointer' }}>
            Study
          </button>
          <button onClick={() => router.push('/cards')} className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ background: view === 'manage' || view === 'create' || view === 'card-detail' ? '#1a1035' : '#ffffff', color: view === 'manage' || view === 'create' || view === 'card-detail' ? '#f0eaff' : '#8b7355', border: '1px solid #e8e0d0', cursor: 'pointer' }}>
            Cards
          </button>
          <button onClick={signOut} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150"
            title="Sign out"
            style={{ background: '#ffffff', border: '1px solid #e8e0d0', color: '#8b7355', cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10 10.5l3-3-3-3M13 7.5H5.5M5.5 13H3a1 1 0 01-1-1V3a1 1 0 011-1h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-8 w-full">

        {isLoading && (
          <div className="w-full py-20 text-center">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#1a1035', fontWeight: 400 }}>
              Loading cards...
            </p>
          </div>
        )}

        {/* ── SELECT VIEW ── */}
        {!isLoading && view === 'select' && (
          <div className="w-full max-w-3xl mx-auto flex flex-col pb-20">
            {deck.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: '#1a1035', fontWeight: 400 }}>No cards yet</p>
                <p className="text-sm mt-2 mb-6" style={{ color: '#8b7355' }}>Add some cards to start studying.</p>
                <button onClick={openCreate} className="px-6 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: '#1a1035', color: '#f0eaff', border: 'none', cursor: 'pointer' }}>
                  Create a card
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: '#8b7355' }}>
                  Choose which groups to include in your session.
                </p>

                {/* All option */}
                <button
                  onClick={stagingAll}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl mb-3 transition-all duration-150"
                  style={{
                    background: !stagingCats ? '#1a1035' : '#ffffff',
                    border: `1px solid ${!stagingCats ? '#1a1035' : '#e8e0d0'}`,
                    boxShadow: !stagingCats ? '0 4px 16px rgba(26,16,53,0.15)' : '0 1px 4px rgba(26,16,53,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: !stagingCats ? 'rgba(255,255,255,0.12)' : '#f5f0e8' }}>
                      ✦
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: !stagingCats ? '#f0eaff' : '#1a1035' }}>All groups</p>
                      <p className="text-xs mt-0.5" style={{ color: !stagingCats ? 'rgba(240,234,255,0.6)' : '#8b7355' }}>{deck.length} cards</p>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: !stagingCats ? '#f0eaff' : '#d0c8bc', background: !stagingCats ? '#f0eaff' : 'transparent' }}>
                    {!stagingCats && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1a1035' }} />}
                  </div>
                </button>

                {/* Category rows */}
                {allCategories.length > 0 && (
                  <div className="flex flex-col gap-2 mb-8">
                    {allCategories.map(cat => {
                      const color = categoryColor(cat, allCategories)
                      const active = isStagingActive(cat)
                      const count = deck.filter(c => c.category === cat).length
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleStaging(cat)}
                          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-150"
                          style={{
                            background: active && stagingCats ? color + '12' : '#ffffff',
                            border: `1px solid ${active && stagingCats ? color + '44' : '#e8e0d0'}`,
                            boxShadow: '0 1px 4px rgba(26,16,53,0.05)',
                            cursor: 'pointer',
                            opacity: !active ? 0.5 : 1,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
                              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold" style={{ color: '#1a1035' }}>{cat}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#8b7355' }}>{count} card{count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: active ? color : 'transparent', border: `2px solid ${active ? color : '#d0c8bc'}` }}>
                            {active && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  onClick={startReview}
                  disabled={stagingCount === 0}
                  className="w-full py-4 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-95"
                  style={{
                    background: stagingCount > 0 ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#e0d8cc',
                    color: stagingCount > 0 ? '#fff' : '#a89880',
                    border: 'none',
                    cursor: stagingCount > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: stagingCount > 0 ? '0 4px 20px rgba(124,58,237,0.35)' : 'none',
                    fontSize: '0.95rem',
                  }}
                >
                  {stagingCount > 0 ? `Start review · ${stagingCount} card${stagingCount !== 1 ? 's' : ''}` : 'Select at least one group'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STUDY VIEW ── */}
        {view === 'study' && (
          <div className="w-full max-w-3xl mx-auto flex flex-col">
            {activeCards.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center pb-20">
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#1a1035', fontWeight: 400 }}>No cards due right now</p>
                <p className="text-sm mt-2 mb-6" style={{ color: '#8b7355' }}>You are caught up. Come back when your next cards are due.</p>
                <button onClick={() => setView('select')} className="px-6 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: '#1a1035', color: '#f0eaff', border: 'none', cursor: 'pointer' }}>
                  Back to selection
                </button>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="flex items-center gap-3 mb-6 w-full">
                  <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: '#e0d8cc' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((index + 1) / activeCards.length) * 100}%`, background: '#1a1035' }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums" style={{ color: '#8b7355' }}>{index + 1} / {activeCards.length}</span>
                </div>

                {card && (
                  <>
                  {/* Category badge */}
                  <div className="mb-5 self-start">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{
                      background: categoryColor(card.category, allCategories) + '22',
                      color: categoryColor(card.category, allCategories),
                      border: `1px solid ${categoryColor(card.category, allCategories)}44`,
                    }}>
                      {card.category}
                    </span>
                  </div>

                  {/* Card */}
                  <div className="w-full cursor-pointer" style={{ perspective: 1200 }} onClick={() => setFlipped(f => !f)}>
                    <div style={{
                      position: 'relative', transformStyle: 'preserve-3d',
                      transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      minHeight: 260,
                    }}>
                      <div style={{
                        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                        position: 'absolute', inset: 0,
                        background: '#ffffff', borderRadius: 20,
                        border: '1px solid #e8e0d0',
                        boxShadow: '0 4px 24px rgba(26,16,53,0.08)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '48px', minHeight: 260,
                      }}>
                        <p className="text-xs font-medium tracking-widest uppercase mb-8" style={{ color: '#c4b89a', letterSpacing: '0.2em' }}>Question</p>
                        <p className="text-center leading-relaxed" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', color: '#1a1035', fontWeight: 400, lineHeight: 1.55 }}>
                          {card.front}
                        </p>
                        <p className="text-xs mt-8" style={{ color: '#c4b89a' }}>Tap to reveal answer</p>
                      </div>
                      <div style={{
                        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        position: 'absolute', inset: 0,
                        background: '#1a1035', borderRadius: 20,
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 4px 24px rgba(26,16,53,0.2)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '48px', minHeight: 260,
                      }}>
                        <p className="text-xs font-medium tracking-widest uppercase mb-8" style={{ color: '#7c6ea0', letterSpacing: '0.2em' }}>Answer</p>
                        <p className="text-center leading-relaxed" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem,2.2vw,1.3rem)', color: '#f0eaff', fontWeight: 300, lineHeight: 1.65 }}>
                          {card.back}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-8 flex items-center gap-4 w-full">
                    <button onClick={() => navigate('prev')} disabled={index === 0}
                      className="flex items-center justify-center w-11 h-11 rounded-full"
                      style={{ background: '#fff', border: '1px solid #e8e0d0', color: index === 0 ? '#c4b89a' : '#1a1035', cursor: index === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 1px 4px rgba(26,16,53,0.06)' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div className="flex-1 flex gap-3">
                      {flipped ? (
                        <>
                          <button onClick={markKnown} disabled={isTransitioningCard} className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}>
                            Got it ✓
                          </button>
                          <button onClick={markSkip} disabled={isTransitioningCard} className="flex-1 py-3 rounded-2xl text-sm font-medium active:scale-95"
                            style={{ background: '#fff', color: '#1a1035', border: '1px solid #e8e0d0', cursor: 'pointer' }}>
                            Not yet ✗
                          </button>
                        </>
                      ) : null}
                    </div>
                    <button onClick={() => navigate('next')} disabled={isLast}
                      className="flex items-center justify-center w-11 h-11 rounded-full"
                      style={{ background: '#fff', border: '1px solid #e8e0d0', color: isLast ? '#c4b89a' : '#1a1035', cursor: isLast ? 'not-allowed' : 'pointer', boxShadow: '0 1px 4px rgba(26,16,53,0.06)' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>

                </>
              )}
            </>
          )}
        </div>
      )}
        {/* ── CARD DETAIL VIEW ── */}
        {view === 'card-detail' && (() => {
          const c = deck.find(d => d.id === detailCardId)
          if (!c) {
            return (
              <div className="w-full max-w-3xl mx-auto pb-20">
                <div className="rounded-2xl p-6 text-center" style={{ background: '#fff', border: '1px solid #e8e0d0' }}>
                  <p className="text-sm" style={{ color: '#8b7355' }}>Card not found.</p>
                  <button onClick={() => router.push('/cards')} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: '#1a1035', color: '#f0eaff', border: 'none', cursor: 'pointer' }}>
                    Back to cards
                  </button>
                </div>
              </div>
            )
          }

          const s = stats[c.id] ?? { correct: 0, incorrect: 0 }
          const history = c.reviews ?? []
          const total = s.correct + s.incorrect
          const pct = total > 0 ? Math.round((s.correct / total) * 100) : 0
          const pctColor = pct >= 70 ? '#4ade80' : pct >= 40 ? '#fb923c' : '#f87171'
          const color = categoryColor(c.category, allCategories)

          return (
            <div className="w-full max-w-3xl mx-auto pb-20">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => router.push('/cards')} className="flex items-center gap-2 text-sm font-medium"
                  style={{ background: 'none', border: 'none', color: '#8b7355', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Cards
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#fff', border: '1px solid #e8e0d0', color: '#8b7355', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Edit
                  </button>
                  <button onClick={async () => { await deleteCard(c.id); router.push('/cards') }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#e57373', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Delete
                  </button>
                </div>
              </div>

              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-5"
                style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                {c.category}
              </span>

              <div className="flex flex-col gap-3 mb-8">
                <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #e8e0d0', boxShadow: '0 2px 12px rgba(26,16,53,0.06)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#c4b89a', letterSpacing: '0.2em' }}>Front</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#1a1035', fontWeight: 400, lineHeight: 1.55 }}>{c.front}</p>
                </div>
                <div className="rounded-2xl p-6" style={{ background: '#1a1035', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(26,16,53,0.15)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7c6ea0', letterSpacing: '0.2em' }}>Back</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#f0eaff', fontWeight: 300, lineHeight: 1.65 }}>{c.back}</p>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Performance</p>
              {total === 0 ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: '#fff', border: '1px solid #e8e0d0' }}>
                  <p className="text-sm" style={{ color: '#8b7355' }}>No attempts yet - study this card to see stats.</p>
                </div>
              ) : (
                <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #e8e0d0', boxShadow: '0 1px 4px rgba(26,16,53,0.05)' }}>
                  <div className="flex items-end gap-3 mb-4">
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: pctColor, fontWeight: 400, lineHeight: 1 }}>{pct}%</span>
                    <span className="text-sm mb-1" style={{ color: '#8b7355' }}>correct</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-5" style={{ background: '#f5f0e8' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pctColor }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Correct', value: s.correct, color: '#4ade80', bg: '#f0fdf4' },
                      { label: 'Incorrect', value: s.incorrect, color: '#f87171', bg: '#fff5f5' },
                      { label: 'Total', value: total, color: '#8b7355', bg: '#f5f0e8' },
                    ].map(({ label, value, color: c2, bg }) => (
                      <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg }}>
                        <p className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: c2, fontWeight: 400 }}>{value}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8b7355' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>
                  Review history
                </p>
                {history.length === 0 ? (
                  <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e8e0d0' }}>
                    <p className="text-sm" style={{ color: '#8b7355' }}>No review history yet.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8e0d0' }}>
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-4"
                        style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1ece3' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: entry.wasCorrect ? '#2f8f57' : '#b94a48' }}>
                            {entry.wasCorrect ? 'Correct' : 'Incorrect'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#8b7355' }}>
                            {formatReviewedAt(entry.reviewedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs" style={{ color: '#8b7355' }}>Rep {entry.srsRepetitions}</p>
                          <p className="text-xs" style={{ color: '#8b7355' }}>{formatDueLabel(entry.dueAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── MANAGE VIEW ── */}
        {view === 'manage' && (
          <div className="w-full max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-medium" style={{ color: '#8b7355' }}>{deck.length} card{deck.length !== 1 ? 's' : ''} in deck</p>
                <p className="text-xs mt-1" style={{ color: '#b29e85' }}>{Object.keys(stats).length} card{Object.keys(stats).length !== 1 ? 's' : ''} attempted</p>
              </div>
              <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                New card
              </button>
            </div>

            {deck.length === 0 ? (
              <div className="text-center py-16">
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#1a1035', fontWeight: 400 }}>No cards yet</p>
                <p className="text-sm mt-2" style={{ color: '#8b7355' }}>Create your first card to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {deck.map((c) => {
                  const s = stats[c.id] ?? { correct: 0, incorrect: 0 }
                  const total = s.correct + s.incorrect
                  const pct = total > 0 ? Math.round((s.correct / total) * 100) : 0
                  const pctColor = pct >= 70 ? '#4ade80' : pct >= 40 ? '#fb923c' : '#f87171'
                  const nextDueLabel = formatDueLabel(c.stat?.dueAt)
                  const color = categoryColor(c.category, allCategories)
                  return (
                    <div key={c.id} className="rounded-2xl p-4 flex flex-col" onClick={() => router.push(`/cards/${c.id}`)}
                      style={{ background: '#fff', border: '1px solid #e8e0d0', boxShadow: '0 1px 4px rgba(26,16,53,0.05)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#c4b8e8')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e0d0')}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full truncate" style={{ background: color + '22', color, maxWidth: '60%' }}>
                              {c.category}
                        </span>
                        <span className="text-base font-semibold tabular-nums shrink-0" style={{ color: pctColor, fontFamily: 'var(--font-display)' }}>
                          {pct}%
                        </span>
                      </div>

                      <p className="text-xs font-medium mb-3" style={{ color: '#1a1035', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.front}
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#8b7355', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.back}
                      </p>

                      <div className="h-1 rounded-full overflow-hidden mb-2.5" style={{ background: '#f5f0e8' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pctColor, transition: 'width 0.5s' }} />
                      </div>

                      <div className="flex justify-between text-xs mb-2">
                        <span style={{ color: '#4ade80' }}>✓ {s.correct}</span>
                        <span style={{ color: '#f87171' }}>✗ {s.incorrect}</span>
                        <span style={{ color: '#c4b89a' }}>{total} total</span>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2">
                        <p className="text-xs" style={{ color: '#8b7355' }}>{nextDueLabel}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={e => { e.stopPropagation(); openEdit(c) }} className="w-8 h-8 flex items-center justify-center rounded-lg"
                            style={{ color: '#8b7355', cursor: 'pointer', background: 'transparent', border: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f0e8')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <button onClick={async e => { e.stopPropagation(); await deleteCard(c.id) }} className="w-8 h-8 flex items-center justify-center rounded-lg"
                            style={{ color: '#e57373', cursor: 'pointer', background: 'transparent', border: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE / EDIT VIEW ── */}
        {view === 'create' && (
          <div className="w-full max-w-3xl mx-auto pb-20">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={cancelCreateOrEdit} className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ background: '#fff', border: '1px solid #e8e0d0', color: '#8b7355', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <h2 style={{ fontFamily: 'var(--font-display)', color: '#1a1035', fontWeight: 400, fontSize: '1.2rem' }}>
                {editingId !== null ? 'Edit card' : 'New card'}
              </h2>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Front (question or word)</label>
                <textarea value={front} onChange={e => setFront(e.target.value)} placeholder="e.g. What is osmosis?" rows={3} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e8e0d0')} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Back (answer or definition)</label>
                <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="e.g. The movement of water molecules through a semipermeable membrane..." rows={4} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e8e0d0')} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Category</label>
                <input type="text" value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. Biology, Vocabulary, Math..."
                  style={{ ...inputStyle, resize: undefined }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e8e0d0')} />
                {/* Existing category suggestions */}
                {allCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allCategories.map(cat => {
                      const color = categoryColor(cat, allCategories)
                      return (
                        <button key={cat} onClick={() => setFormCategory(cat)}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                          style={{
                            background: formCategory === cat ? color + '33' : '#fff',
                            color: formCategory === cat ? color : '#8b7355',
                            border: `1px solid ${formCategory === cat ? color + '66' : '#e8e0d0'}`,
                            cursor: 'pointer',
                          }}>
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {(front || back) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#8b7355', letterSpacing: '0.15em' }}>Preview</p>
                  <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8e0d0' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#1a1035' }}>{front || '—'}</p>
                    <div className="h-px my-3" style={{ background: '#e8e0d0' }} />
                    <p className="text-sm" style={{ color: '#8b7355' }}>{back || '—'}</p>
                  </div>
                </div>
              )}

              {editingId !== null ? (
                <div className="flex gap-3">
                  <button onClick={cancelCreateOrEdit} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-95"
                    style={{ background: '#fff', color: '#8b7355', border: '1px solid #e8e0d0', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={saveCard} disabled={!front.trim() || !back.trim()} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-95"
                    style={{
                      background: front.trim() && back.trim() ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#e0d8cc',
                      color: front.trim() && back.trim() ? '#fff' : '#a89880',
                      border: 'none',
                      cursor: front.trim() && back.trim() ? 'pointer' : 'not-allowed',
                      boxShadow: front.trim() && back.trim() ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
                    }}>
                    Save changes
                  </button>
                </div>
              ) : (
                <button onClick={saveCard} disabled={!front.trim() || !back.trim()} className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-95"
                  style={{
                    background: front.trim() && back.trim() ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#e0d8cc',
                    color: front.trim() && back.trim() ? '#fff' : '#a89880',
                    border: 'none',
                    cursor: front.trim() && back.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: front.trim() && back.trim() ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
                  }}>
                  Add to deck
                </button>
              )}
            </div>
          </div>
        )}

        <div className="h-8" />
      </main>
    </div>
  )
}
