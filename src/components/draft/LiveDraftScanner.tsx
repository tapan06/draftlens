import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  PictureInPicture2,
  Plus,
  Radar,
  RotateCcw,
  Scan,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { opendota, type PlayerMatch, type PlayerSearchResult } from '@/lib/api/opendota';
import { parseSteamInput } from '@/lib/api/steam';
import { HERO_FINGERPRINTS } from '@/lib/data/heroFingerprints';
import type { HeroIndex } from '@/hooks/useDotaData';
import { ROLE_BY_ID, classifyMatches, filterRelevant } from '@/lib/analytics/roles';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeroImage } from '@/components/ui/HeroImage';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, kda, pct, timeAgo, toneText, wrTone } from '@/lib/utils';

/* ==========================================================================
   1. Детектор раскладки (Стадия пиков vs Внутриигровой HUD) и распознавание
   ========================================================================== */

interface HudLayout {
  name: 'draft' | 'draft_picked' | 'ingame';
  label: string;
  radiantX: number[];
  direX: number[];
  slotW: number;
  slotH: number;
  /** Где находится полоска цвета игрока относительно портрета героя. */
  barPosition: 'below' | 'above';
  /** Допустимый диапазон Y для полосок игроков (в долях от высоты экрана vh). */
  minBarYRatio: number;
  maxBarYRatio: number;
}

const LAYOUTS: HudLayout[] = [
  {
    name: 'draft',
    label: 'Стадия пиков (начало / медали)',
    radiantX: [0.117, 0.181, 0.245, 0.309, 0.373],
    direX: [0.577, 0.641, 0.705, 0.769, 0.833],
    slotW: 0.052,
    slotH: 0.056,
    barPosition: 'below',
    minBarYRatio: 0.035,
    maxBarYRatio: 0.17,
  },
  {
    name: 'draft_picked',
    label: 'Стадия пиков (идёт выбор героев)',
    radiantX: [0.118, 0.182, 0.246, 0.310, 0.374],
    direX: [0.578, 0.642, 0.706, 0.770, 0.834],
    slotW: 0.052,
    slotH: 0.065,
    barPosition: 'above',
    minBarYRatio: 0.0,
    maxBarYRatio: 0.055,
  },
  {
    name: 'ingame',
    label: 'Верхняя панель в катке (In-Game HUD)',
    radiantX: [0.298, 0.332, 0.366, 0.400, 0.434],
    direX: [0.534, 0.568, 0.602, 0.636, 0.670],
    slotW: 0.032,
    slotH: 0.035,
    barPosition: 'above',
    minBarYRatio: 0.0,
    maxBarYRatio: 0.055,
  },
];

/**
 * Цветовые валидаторы 10 фиксированных полосок игроков Dota 2:
 *   Radiant 1..5: Синий, Бирюзовый, Фиолетовый, Жёлтый, Оранжевый
 *   Dire    1..5: Розовый, Оливковый, Голубой, Тёмно-зелёный, Коричневый
 * Ориентируются прежде всего на соотношение цветовых каналов (устойчивы к сглаживанию и лёгкому затемнению),
 * при этом полностью отсекают серый/белый текст и кнопки главного меню.
 */
const STRICT_BAR_VALIDATORS: Array<(r: number, g: number, b: number) => boolean> = [
  (r, g, b) => b > r + 40 && b > g + 20 && b > 90,
  (r, g, b) => g > r + 38 && b > r + 30 && g > 105 && b > 90,
  (r, g, b) => b > g + 25 && r > g + 14 && b > 78,
  (r, g, b) => r > b + 38 && g > b + 38 && r > 110 && g > 110,
  (r, g, b) => r > g + 25 && r > b + 60 && r > 115 && g > 50,
  (r, g, b) => r > g + 22 && b > g + 10 && r > 110 && b > 85,
  (r, g, b) => g > b + 20 && r > b + 12 && g >= r - 6 && g > 80,
  (r, g, b) => b > r + 35 && g > r + 25 && b > 105 && g > 90,
  (r, g, b) => g > r + 14 && g > b + 14 && g > 48 && r < 95 && b < 85,
  (r, g, b) => r > b + 28 && g > b + 15 && r > 68 && b < 80,
];

interface DetectedHud {
  layout: HudLayout;
  barY: number;
  offsetX: number;
  refW: number;
}

const BAR_SAMPLE_FRACTIONS = [0.22, 0.42, 0.62, 0.78] as const;

/**
 * Ищет полосу из цветных индикаторов игроков, проверяя 4 точки (22%, 42%, 62%, 78%)
 * внутри каждого слота. Это полностью отсекает ники игроков и UI главного меню,
 * но уверенно ловит реальные полоски даже при затемнении, анимации хода и игре с ботами.
 */
function detectHudLayoutAndBarY(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  cropH: number,
): DetectedHud | null {
  const aspect = vw / vh;
  const candidateBoxes: Array<{ offsetX: number; refW: number }> =
    aspect > 1.82
      ? [
          { offsetX: Math.round((vw - vh * (16 / 9)) / 2), refW: Math.round(vh * (16 / 9)) },
          { offsetX: 0, refW: vw },
        ]
      : aspect < 1.72
        ? [
            { offsetX: 0, refW: vw },
            { offsetX: Math.round((vw - vh * (16 / 9)) / 2), refW: Math.round(vh * (16 / 9)) },
          ]
        : [{ offsetX: 0, refW: vw }];

  let best: (DetectedHud & { score: number }) | null = null;

  for (const box of candidateBoxes) {
    for (const layout of LAYOUTS) {
      const allX = [...layout.radiantX, ...layout.direX];
      const minY = Math.max(0, Math.floor(vh * layout.minBarYRatio));
      const maxY = Math.min(cropH - 1, Math.floor(vh * layout.maxBarYRatio));
      const rowData = ctx.getImageData(0, minY, vw, Math.max(1, maxY - minY + 1)).data;

      for (let y = minY; y <= maxY; y++) {
        const rowOffset = (y - minY) * vw * 4;
        let radHits = 0;
        let direHits = 0;
        let chromaSum = 0;

        for (let i = 0; i < 10; i++) {
          const sx = box.offsetX + allX[i] * box.refW;
          const sw = layout.slotW * box.refW;
          const validator = STRICT_BAR_VALIDATORS[i];

          let allOk = true;
          let rFirst = 0, gFirst = 0, bFirst = 0;
          let rLast = 0, gLast = 0, bLast = 0;
          let slotChroma = 0;

          for (let pIdx = 0; pIdx < BAR_SAMPLE_FRACTIONS.length; pIdx++) {
            const xPix = Math.min(vw - 1, Math.max(0, Math.floor(sx + sw * BAR_SAMPLE_FRACTIONS[pIdx]))) * 4;
            const r = rowData[rowOffset + xPix];
            const g = rowData[rowOffset + xPix + 1];
            const b = rowData[rowOffset + xPix + 2];
            if (!validator(r, g, b)) {
              allOk = false;
              break;
            }
            if (pIdx === 0) {
              rFirst = r;
              gFirst = g;
              bFirst = b;
            }
            if (pIdx === BAR_SAMPLE_FRACTIONS.length - 1) {
              rLast = r;
              gLast = g;
              bLast = b;
            }
            if (pIdx === 1) {
              slotChroma = Math.max(r, g, b) - Math.min(r, g, b);
            }
          }

          if (!allOk) continue;
          const uniform = Math.abs(rFirst - rLast) + Math.abs(gFirst - gLast) + Math.abs(bFirst - bLast) < 115;
          if (uniform) {
            if (i < 5) radHits++;
            else direHits++;
            chromaSum += slotChroma;
          }
        }

        const totalHits = radHits + direHits;
        // Допускаем минимум 5 полосок (>=3 с одной стороны и >=1 с другой), чтобы ловить и неполные/бот-лобби
        if (totalHits >= 5 && Math.max(radHits, direHits) >= 3 && Math.min(radHits, direHits) >= 1) {
          const score = totalHits * 1000 + chromaSum;
          if (!best || score > best.score) {
            best = { layout, barY: y, offsetX: box.offsetX, refW: box.refW, score };
          }
        }
      }
    }
  }

  return best ? { layout: best.layout, barY: best.barY, offsetX: best.offsetX, refW: best.refW } : null;
}

/** Зеркально отражает 6x4 RGB-вектор по горизонтали (для слотов Dire, развёрнутых к центру). */
function mirrorVectorX(vec: number[], cols = 6, rows = 4): number[] {
  const out = new Array<number>(vec.length);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const srcIdx = (gy * cols + (cols - 1 - gx)) * 3;
      const dstIdx = (gy * cols + gx) * 3;
      out[dstIdx] = vec[srcIdx];
      out[dstIdx + 1] = vec[srcIdx + 1];
      out[dstIdx + 2] = vec[srcIdx + 2];
    }
  }
  return out;
}

/**
 * Маска правого нижнего угла 6x4 сетки (ячейки [16,17,22,23]), где отображается щит уровня Dota Plus
 * (например, 22 уровень «Мастер» или 30 «Грандмастер»), который перекрывает портрет героя.
 */
const BADGE_MASK_BR: number[] = (() => {
  const w = new Array<number>(72).fill(1);
  for (const idx of [16, 17, 22, 23]) {
    w[idx * 3] = 0;
    w[idx * 3 + 1] = 0;
    w[idx * 3 + 2] = 0;
  }
  return w;
})();

const BADGE_MASK_BL: number[] = (() => {
  const w = new Array<number>(72).fill(1);
  for (const idx of [12, 13, 18, 19]) {
    w[idx * 3] = 0;
    w[idx * 3 + 1] = 0;
    w[idx * 3 + 2] = 0;
  }
  return w;
})();

/**
 * Пропорциональное масштабирование яркости (без искусственного растяжения контраста,
 * которое раньше превращало серые медали рангов в Terrorblade / Witch Doctor).
 */
function distScaleOnly(a: number[], b: number[], w?: number[]): number {
  let dot = 0;
  let bb = 0;
  let ws = 0;
  for (let i = 0; i < a.length; i++) {
    const wi = w ? w[i] : 1;
    if (!wi) continue;
    dot += wi * a[i] * b[i];
    bb += wi * b[i] * b[i];
    ws += wi;
  }
  const alpha = Math.min(1.35, Math.max(0.68, dot / Math.max(1, bb)));
  let distSq = 0;
  for (let i = 0; i < a.length; i++) {
    const wi = w ? w[i] : 1;
    if (!wi) continue;
    const diff = a[i] - alpha * b[i];
    distSq += wi * diff * diff;
  }
  return Math.sqrt(distSq / Math.max(1, ws));
}

function pearson(a: number[], b: number[], w?: number[]): number {
  let ma = 0;
  let mb = 0;
  let ws = 0;
  for (let i = 0; i < a.length; i++) {
    const wi = w ? w[i] : 1;
    if (!wi) continue;
    ma += wi * a[i];
    mb += wi * b[i];
    ws += wi;
  }
  ma /= Math.max(1, ws);
  mb /= Math.max(1, ws);
  let num = 0;
  let da2 = 0;
  let db2 = 0;
  for (let i = 0; i < a.length; i++) {
    const wi = w ? w[i] : 1;
    if (!wi) continue;
    const da = a[i] - ma;
    const db = b[i] - mb;
    num += wi * da * db;
    da2 += wi * da * da;
    db2 += wi * db * db;
  }
  return num / Math.max(1e-6, Math.sqrt(da2 * db2));
}

/**
 * Анализирует слот портрета:
 *   1) Отсекает пустые/чёрные слоты и неутверждённые ч/б «теневые пики» до Lock In.
 *   2) Распознаёт характерную структуру непикнутого слота: тёмно-стальные края + яркая медаль ранга по центру.
 *   3) Сравнивает с базой 127 героев (включая Арканы, Личности и фолбэк с маской значка Dota Plus).
 */
function recognizeSlotHero(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  cols = 6,
  rows = 4,
): { heroId: number | null; looksLikeMedal: boolean } {
  const offsets = [0, -sw * 0.04, sw * 0.04];
  let primaryMedal = false;
  let bestId = -1;
  let bestDist = Infinity;
  let bestCorr = 0;
  let maskBestId = -1;
  let maskBestDist = Infinity;
  let maskBestCorr = 0;
  let rejectedLowChroma = true;

  for (let oi = 0; oi < offsets.length; oi++) {
    const x0 = Math.max(0, Math.floor(sx + offsets[oi] + sw * 0.08));
    const y0 = Math.max(0, Math.floor(sy + sh * 0.1));
    const w = Math.max(6, Math.floor(sw * 0.84));
    const h = Math.max(4, Math.floor(sh * 0.76));

    const imgData = ctx.getImageData(x0, y0, w, h).data;
    const cw = w / cols;
    const ch = h / rows;

    const vec: number[] = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        const cx0 = Math.floor(gx * cw);
        const cx1 = Math.max(cx0 + 1, Math.floor((gx + 1) * cw));
        const cy0 = Math.floor(gy * ch);
        const cy1 = Math.max(cy0 + 1, Math.floor((gy + 1) * ch));

        for (let y = cy0; y < cy1; y++) {
          for (let x = cx0; x < cx1; x++) {
            const i = (y * w + x) * 4;
            r += imgData[i];
            g += imgData[i + 1];
            b += imgData[i + 2];
            n++;
          }
        }
        vec.push(Math.round(r / n), Math.round(g / n), Math.round(b / n));
      }
    }

    // 1. Проверка яркости, насыщенности, контраста и межцветовой вариации
    // Отсекает пустые слоты, полосу цвета игрока и полупрозрачные ч/б «теневые пики»
    const cells = vec.length / 3;
    let mean = 0;
    let spread = 0;
    let maxSat = 0;
    let sumL = 0;
    let sumL2 = 0;
    let sumRB = 0;
    let sumRB2 = 0;
    let sumRG = 0;
    let sumRG2 = 0;

    for (let i = 0; i < vec.length; i += 3) {
      const r = vec[i];
      const g = vec[i + 1];
      const b = vec[i + 2];
      mean += (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      spread += sat;
      if (sat > maxSat) maxSat = sat;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += lum;
      sumL2 += lum * lum;
      const rb = r - b;
      const rg = r - g;
      sumRB += rb;
      sumRB2 += rb * rb;
      sumRG += rg;
      sumRG2 += rg * rg;
    }
    mean /= cells;
    spread /= cells;
    const meanL = sumL / cells;
    const stdL = Math.sqrt(Math.max(0, sumL2 / cells - meanL * meanL));
    const meanRB = sumRB / cells;
    const stdRB = Math.sqrt(Math.max(0, sumRB2 / cells - meanRB * meanRB));
    const meanRG = sumRG / cells;
    const stdRG = Math.sqrt(Math.max(0, sumRG2 / cells - meanRG * meanRG));
    const colorVar = Math.max(stdRB, stdRG);

    if (mean < 18 || spread < 6 || maxSat < 18 || stdL < 10.5 || colorVar < 6.5) {
      if (oi === 0) break;
      continue;
    }
    rejectedLowChroma = false;

    // 2. Детектор пустого слота с медалью ранга (тёмно-стальные края + яркий центр)
    const outerCoords = [
      [0, 0],
      [1, 0],
      [4, 0],
      [5, 0],
      [0, 1],
      [1, 1],
      [4, 1],
      [5, 1],
      [0, 2],
      [5, 2],
    ];
    let slateOuter = 0;
    let outerLumSum = 0;
    for (const [gx, gy] of outerCoords) {
      const i = (gy * 6 + gx) * 3;
      const r = vec[i];
      const g = vec[i + 1];
      const b = vec[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      outerLumSum += lum;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (b >= r + 3 && sat <= 34 && lum <= 92) slateOuter++;
    }
    const outerMeanLum = outerLumSum / outerCoords.length;

    let centerLumSum = 0;
    for (const [gx, gy] of [
      [2, 0],
      [3, 0],
      [2, 1],
      [3, 1],
    ]) {
      const i = (gy * 6 + gx) * 3;
      centerLumSum += 0.299 * vec[i] + 0.587 * vec[i + 1] + 0.114 * vec[i + 2];
    }
    const c2o = centerLumSum / 4 - outerMeanLum;
    const looksLikeMedal = slateOuter >= 5 && c2o >= 40;
    if (oi === 0) primaryMedal = looksLikeMedal;

    // 3. Поиск ближайшего героя по базе отпечатков (+ проверка с маской значка Dota Plus)
    const flipped = mirrorVectorX(vec);
    for (const [idStr, templates] of Object.entries(HERO_FINGERPRINTS)) {
      for (const ref of templates) {
        const d1 = distScaleOnly(vec, ref);
        const d2 = distScaleOnly(flipped, ref) + 1.5;
        const d = d1 <= d2 ? d1 : d2;
        if (d < bestDist) {
          bestDist = d;
          bestId = Number(idStr);
          bestCorr = d1 <= d2 ? pearson(vec, ref) : pearson(flipped, ref);
        }

        if (!looksLikeMedal && oi === 0) {
          const md1 = distScaleOnly(vec, ref, BADGE_MASK_BR);
          const md2 = distScaleOnly(flipped, ref, BADGE_MASK_BL) + 1.5;
          const md = md1 <= md2 ? md1 : md2;
          if (md < maskBestDist) {
            maskBestDist = md;
            maskBestId = Number(idStr);
            maskBestCorr = md1 <= md2 ? pearson(vec, ref, BADGE_MASK_BR) : pearson(flipped, ref, BADGE_MASK_BL);
          }
        }
      }
    }

    if (oi === 0 && bestDist <= 18.0 && bestCorr >= 0.78) break;
  }

  if (rejectedLowChroma) {
    return { heroId: null, looksLikeMedal: false };
  }

  // Строгие пороги: обычное сравнение + фолбэк с маскированием значка уровня Dota Plus (22/25/30 ранг)
  const maxDist = primaryMedal ? 21.0 : 23.0;
  const minCorr = 0.7;
  let heroId = bestId > 0 && bestDist <= maxDist && bestCorr >= minCorr ? bestId : null;
  if (heroId == null && !primaryMedal && maskBestId > 0 && maskBestDist <= 19.5 && maskBestCorr >= 0.8) {
    heroId = maskBestId;
  }
  return { heroId, looksLikeMedal: heroId == null && primaryMedal };
}

/* ==========================================================================
   2. Сканер последних 20 матчей игроков по нику / Steam ID
   ========================================================================== */

interface ScoutSlot {
  id: string;
  rawInput: string;
  selectedAccountId: number | null;
}

interface RecentHeroSummary {
  heroId: number;
  games: number;
  wins: number;
  wr: number;
  kda: number;
  isSpammer: boolean;
}

function summarizeRecent20(matches: PlayerMatch[], heroIndex: HeroIndex) {
  const relevant = filterRelevant(matches).slice(0, 20);
  const classified = classifyMatches(relevant, heroIndex.positions);
  const wins = classified.filter((m) => m.win).length;

  let streak = 0;
  for (const m of classified) {
    if (m.win === classified[0]?.win) streak++;
    else break;
  }
  const streakWin = classified[0]?.win ?? false;

  const roleCount: Record<string, number> = {};
  for (const m of classified) roleCount[m.role] = (roleCount[m.role] ?? 0) + 1;
  const mainRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | keyof typeof ROLE_BY_ID
    | undefined;

  const byHero = new Map<number, typeof classified>();
  for (const m of classified) {
    const arr = byHero.get(m.hero_id) ?? [];
    arr.push(m);
    byHero.set(m.hero_id, arr);
  }

  const heroes: RecentHeroSummary[] = [];
  for (const [heroId, list] of byHero) {
    const g = list.length;
    const w = list.filter((m) => m.win).length;
    const wr = w / g;
    const K = list.reduce((s, m) => s + m.kills, 0);
    const D = list.reduce((s, m) => s + m.deaths, 0);
    const A = list.reduce((s, m) => s + m.assists, 0);
    const heroKda = kda(K, D, A);
    const isSpammer = g >= 4 || (g >= 3 && wr >= 0.66);
    heroes.push({
      heroId,
      games: g,
      wins: w,
      wr,
      kda: heroKda,
      isSpammer,
    });
  }

  heroes.sort((a, b) => b.games - a.games || b.wins - a.wins || b.kda - a.kda);

  return {
    total: classified.length,
    wins,
    wr: classified.length ? wins / classified.length : 0,
    streak,
    streakWin,
    mainRole,
    topHeroes: heroes.slice(0, 4),
  };
}

function ScoutPlayerRow({
  slot,
  heroIndex,
  onSelectAccount,
  onRemove,
  onPickEnemyHero,
}: {
  slot: ScoutSlot;
  heroIndex: HeroIndex;
  onSelectAccount: (accountId: number) => void;
  onRemove: () => void;
  onPickEnemyHero: (heroId: number) => void;
}) {
  const parsed = parseSteamInput(slot.rawInput);
  const directId = parsed.kind === 'id' ? parsed.accountId : null;
  const searchQuery = parsed.kind === 'name' ? parsed.query : parsed.kind === 'vanity' ? parsed.vanity : null;

  const searchRes = useQuery({
    queryKey: ['scout-search', searchQuery],
    queryFn: () => opendota.search(searchQuery!),
    enabled: !!searchQuery && !directId,
  });

  const candidates: PlayerSearchResult[] = searchRes.data?.slice(0, 5) ?? [];
  const activeAccountId = slot.selectedAccountId ?? directId ?? candidates[0]?.account_id ?? null;

  const profileQuery = useQuery({
    queryKey: ['player', activeAccountId],
    queryFn: () => opendota.player(activeAccountId!),
    enabled: !!activeAccountId,
  });

  const matchesQuery = useQuery({
    queryKey: ['player', activeAccountId, 'matches', 20],
    queryFn: () => opendota.playerMatches(activeAccountId!, 20),
    enabled: !!activeAccountId,
  });

  const summary = matchesQuery.data ? summarizeRecent20(matchesQuery.data, heroIndex) : null;
  const playerName =
    profileQuery.data?.profile?.personaname ??
    candidates.find((c) => c.account_id === activeAccountId)?.personaname ??
    slot.rawInput;

  return (
    <div className="rounded-xl border border-line bg-surface-2/70 p-3 transition hover:border-line-strong">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {profileQuery.data?.profile?.avatarfull ? (
            <img src={profileQuery.data.profile.avatarfull} alt="" className="h-8 w-8 rounded-lg ring-1 ring-line-strong" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-xs font-bold text-fg-dim">?</div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-bold text-fg">{playerName}</span>
              {summary?.mainRole && <Badge tone="cyan">{ROLE_BY_ID[summary.mainRole].label}</Badge>}
              {summary && summary.total > 0 && (
                <span className={cn('num text-xs font-bold', toneText[wrTone(summary.wr)])}>
                  {pct(summary.wr, 0)} WR ({summary.wins}W–{summary.total - summary.wins}L)
                </span>
              )}
              {summary && summary.streak >= 3 && (
                <Badge tone={summary.streakWin ? 'green' : 'red'} icon={<Flame className="h-3 w-3" />}>
                  {summary.streakWin ? `Винстрик ${summary.streak}` : `Лузстрик ${summary.streak} (тильт)`}
                </Badge>
              )}
            </div>

            {candidates.length > 1 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-2xs text-fg-dim">
                <span>Аккаунт:</span>
                {candidates.map((c) => (
                  <button
                    key={c.account_id}
                    type="button"
                    onClick={() => onSelectAccount(c.account_id)}
                    className={cn(
                      'num rounded px-1.5 py-0.5 transition',
                      c.account_id === activeAccountId
                        ? 'bg-accent/20 font-semibold text-accent ring-1 ring-accent/40'
                        : 'bg-surface-3 text-fg-muted hover:text-fg',
                    )}
                    title={c.last_match_time ? `Последний матч: ${timeAgo(new Date(c.last_match_time).getTime() / 1000)}` : ''}
                  >
                    {c.personaname} #{String(c.account_id).slice(-4)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={onRemove} className="btn-ghost btn-sm text-fg-dim hover:text-win-low" title="Удалить">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {searchRes.isLoading || matchesQuery.isLoading ? (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-fg-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Проверяем последние 20 игр через OpenDota…
        </div>
      ) : !activeAccountId ? (
        <div className="mt-2 text-xs text-win-mid">Игрок «{slot.rawInput}» не найден в базе OpenDota.</div>
      ) : summary && summary.total === 0 ? (
        <div className="mt-2 text-xs text-fg-dim">История матчей этого игрока скрыта в настройках Dota 2.</div>
      ) : (
        summary && (
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.topHeroes.map((h) => {
              const hero = heroIndex.byId.get(h.heroId);
              return (
                <div
                  key={h.heroId}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-lg border p-2 transition',
                    h.isSpammer
                      ? 'border-primary/60 bg-primary/10 shadow-glow-red'
                      : 'border-line bg-surface/80 hover:border-line-strong',
                  )}
                >
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded ring-1 ring-line-strong">
                    <HeroImage hero={hero} className="h-full w-full" />
                    {h.isSpammer && (
                      <span className="absolute left-0.5 top-0.5 flex items-center gap-0.5 rounded bg-primary px-1 text-[8px] font-extrabold uppercase text-white">
                        <Ban className="h-2 w-2" /> СПАМ
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{hero?.localized_name}</div>
                    <div className="num text-2xs text-fg-muted">
                      <strong className="text-fg">{h.games}</strong>/20 ·{' '}
                      <span className={cn('font-bold', toneText[wrTone(h.wr)])}>{pct(h.wr, 0)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPickEnemyHero(h.heroId)}
                      className="mt-0.5 text-[10px] font-semibold text-accent hover:underline"
                    >
                      +В пик врага
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ==========================================================================
   3. Главный компонент LiveDraftScanner
   ========================================================================== */

interface SlotTemporalState {
  lockedHeroId: number | null;
  lastCandidate: number | null;
  candidateStreak: number;
}

const emptyTemporal = (): SlotTemporalState => ({
  lockedHeroId: null,
  lastCandidate: null,
  candidateStreak: 0,
});

const TEAM_SLOT_COLORS = {
  radiant: [
    { name: 'Синий', hex: '#3375FF' },
    { name: 'Бирюз.', hex: '#66FFBF' },
    { name: 'Фиол.', hex: '#BF00BF' },
    { name: 'Жёлтый', hex: '#F3F00B' },
    { name: 'Оранж.', hex: '#FF6B00' },
  ],
  dire: [
    { name: 'Розов.', hex: '#FE86C2' },
    { name: 'Оливк.', hex: '#A1B447' },
    { name: 'Голуб.', hex: '#65D9F7' },
    { name: 'Зелён.', hex: '#008321' },
    { name: 'Корич.', hex: '#A46900' },
  ],
} as const;

export function LiveDraftScanner({
  heroIndex,
  onAddEnemyHero,
  onSyncDetectedDraft,
  onCaptureStateChange,
}: {
  heroIndex: HeroIndex;
  onAddEnemyHero: (heroId: number) => void;
  onSyncDetectedDraft: (enemies: number[], allies: number[], myHeroId?: number | null) => void;
  onCaptureStateChange?: (capturing: boolean) => void;
}) {
  const [mode, setMode] = useState<'screen' | 'scout'>('screen');

  // --- Состояние захвата экрана ---
  const [myTeam, setMyTeam] = useState<'radiant' | 'dire'>('radiant');
  const [mySlotIdx, setMySlotIdx] = useState<number | null>(null);
  const mySlotIdxRef = useRef<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [activeLayoutName, setActiveLayoutName] = useState<string | null>(null);
  const [detectedRadiant, setDetectedRadiant] = useState<(number | null)[]>([null, null, null, null, null]);
  const [detectedDire, setDetectedDire] = useState<(number | null)[]>([null, null, null, null, null]);

  // Буфер межкадрового подтверждения (требует 2 совпадения подряд; зафиксированные герои сохраняются при Alt+Tab)
  const temporalRadRef = useRef<SlotTemporalState[]>(Array.from({ length: 5 }, emptyTemporal));
  const temporalDireRef = useRef<SlotTemporalState[]>(Array.from({ length: 5 }, emptyTemporal));
  const hudMissStreakRef = useRef<number>(0);
  const newMatchResetStreakRef = useRef<number>(0);
  const lastSyncedKeyRef = useRef<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Состояние пробива по нику/ID ---
  const [input, setInput] = useState('');
  const [slots, setSlots] = useState<ScoutSlot[]>([]);

  const clearLockedSlots = () => {
    temporalRadRef.current = Array.from({ length: 5 }, emptyTemporal);
    temporalDireRef.current = Array.from({ length: 5 }, emptyTemporal);
    hudMissStreakRef.current = 0;
    newMatchResetStreakRef.current = 0;
    lastSyncedKeyRef.current = '';
    setDetectedRadiant([null, null, null, null, null]);
    setDetectedDire([null, null, null, null, null]);
    onSyncDetectedDraft([], [], null);
  };

  const stopCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    hudMissStreakRef.current = 0;
    newMatchResetStreakRef.current = 0;
    setCapturing(false);
    setActiveLayoutName(null);
    onCaptureStateChange?.(false);
  };

  useEffect(() => {
    return () => stopCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCapture = async () => {
    setCaptureError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCaptureError('Захват экрана поддерживается только в браузерах на ПК (Chrome, Opera GX, Edge).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 2 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setCapturing(false);
        setActiveLayoutName(null);
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      clearLockedSlots();
      setCapturing(true);
      onCaptureStateChange?.(true);
    } catch {
      setCaptureError('Доступ к захвату экрана не был выдан.');
    }
  };

  const selectMySlot = (idx: number | null, team = myTeam) => {
    mySlotIdxRef.current = idx;
    setMySlotIdx(idx);
    syncFromTemporal(team, true);
  };

  const syncFromTemporal = (team: 'radiant' | 'dire', force = false) => {
    const radIds = temporalRadRef.current.map((s) => s.lockedHeroId);
    const direIds = temporalDireRef.current.map((s) => s.lockedHeroId);
    const slotMe = mySlotIdxRef.current;
    const key = `${team}:${slotMe ?? 'none'}:${radIds.join(',')}|${direIds.join(',')}`;
    if (!force && key === lastSyncedKeyRef.current) return;
    lastSyncedKeyRef.current = key;

    setDetectedRadiant(radIds);
    setDetectedDire(direIds);

    const radValid = radIds.filter((id): id is number => id != null);
    const direValid = direIds.filter((id): id is number => id != null);
    const enemies = team === 'radiant' ? direValid : radValid;
    const mySideIds = team === 'radiant' ? radIds : direIds;
    const myHeroId = slotMe != null ? mySideIds[slotMe] ?? null : null;
    const allies = mySideIds
      .filter((id, idx): id is number => id != null && idx !== slotMe)
      .slice(0, 4);
    onSyncDetectedDraft(enemies, allies, myHeroId);
  };

  /**
   * Сканирует текущий кадр окна Dota 2 с межкадровой верификацией:
   *   1) 4-точечный цветовой детектор 10 полосок игроков (устойчив к свечению хода, ботам и сглаживанию).
   *   2) Отсекает пустые слоты с медалями рангов и «теневые пики» до нажатия Lock In.
   *   3) Фиксирует героя после 2 подряд совпадений и НИКОГДА не стирает уже пикнутых героев поодиночке —
   *      сброс идёт только кнопкой «Очистить слоты» или при старте нового пустого лобби (>=7 медалей 6 кадров подряд).
   */
  const scanCurrentFrame = () => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const cropH = Math.floor(vh * 0.2);
    canvas.width = vw;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vw, cropH, 0, 0, vw, cropH);

    const detected = detectHudLayoutAndBarY(ctx, vw, vh, cropH);
    if (!detected) {
      // При кратком моргании/подсветке (до 3 кадров) не дёргаем статус и никогда не стираем пики!
      hudMissStreakRef.current++;
      if (hudMissStreakRef.current > 3) {
        setActiveLayoutName(null);
      }
      return;
    }

    hudMissStreakRef.current = 0;
    const { layout, barY, offsetX, refW } = detected;
    setActiveLayoutName(layout.label);

    const slotW = refW * layout.slotW;
    const slotH = vh * layout.slotH;
    const slotY =
      layout.barPosition === 'below'
        ? Math.max(2, barY - slotH)
        : Math.min(cropH - slotH - 2, barY + Math.max(1, Math.round(vh * 0.002)));

    const radResults = layout.radiantX.map((rx) => recognizeSlotHero(ctx, offsetX + rx * refW, slotY, slotW, slotH));
    const direResults = layout.direX.map((rx) => recognizeSlotHero(ctx, offsetX + rx * refW, slotY, slotW, slotH));

    // Считаем статистику всего кадра для безопасного авто-сброса при новом матче
    const allLockedBefore = [...temporalRadRef.current, ...temporalDireRef.current].filter((s) => s.lockedHeroId != null);
    const allPairs = [
      ...radResults.map((res, i) => ({ res, state: temporalRadRef.current[i] })),
      ...direResults.map((res, i) => ({ res, state: temporalDireRef.current[i] })),
    ];
    const matchedHeroesThisFrame = allPairs.filter((p) => p.res.heroId != null).length;
    const medalSlotsCount = allPairs.filter((p) => p.res.looksLikeMedal).length;
    const allLockedBecameMedals = allLockedBefore.length > 0 && allPairs.every((p) => !p.state.lockedHeroId || p.res.looksLikeMedal);

    if (layout.name === 'draft' && allLockedBefore.length > 0 && matchedHeroesThisFrame === 0 && medalSlotsCount >= 7 && allLockedBecameMedals) {
      newMatchResetStreakRef.current++;
      if (newMatchResetStreakRef.current >= 6) {
        clearLockedSlots();
        return;
      }
    } else {
      newMatchResetStreakRef.current = 0;
    }

    const usedIds = new Set<number>();
    for (const s of temporalRadRef.current) if (s.lockedHeroId) usedIds.add(s.lockedHeroId);
    for (const s of temporalDireRef.current) if (s.lockedHeroId) usedIds.add(s.lockedHeroId);

    const applyResults = (results: Array<{ heroId: number | null; looksLikeMedal: boolean }>, states: SlotTemporalState[]) => {
      results.forEach(({ heroId }, idx) => {
        const st = states[idx];
        if (heroId == null) {
          st.lastCandidate = null;
          st.candidateStreak = 0;
          return;
        }
        if (st.lockedHeroId === heroId) return;

        if (st.lastCandidate === heroId) {
          st.candidateStreak++;
        } else {
          st.lastCandidate = heroId;
          st.candidateStreak = 1;
        }

        // Подтверждаем только если 2 кадра подряд уверенно распознали одного и того же героя
        if (st.candidateStreak >= 2 && !usedIds.has(heroId)) {
          if (st.lockedHeroId != null) usedIds.delete(st.lockedHeroId);
          st.lockedHeroId = heroId;
          usedIds.add(heroId);
        }
      });
    };

    applyResults(radResults, temporalRadRef.current);
    applyResults(direResults, temporalDireRef.current);

    // Отрисовываем аккуратные калибровочные рамки ПОСЛЕ чтения пикселей
    const drawBoxes = (xs: number[], states: SlotTemporalState[], idleColor: string) => {
      xs.forEach((rx, idx) => {
        const sx = offsetX + rx * refW;
        const st = states[idx];
        ctx.strokeStyle = st.lockedHeroId ? '#10B981' : st.lastCandidate ? '#F59E0B' : idleColor;
        ctx.lineWidth = Math.max(2, Math.round(vw / 500));
        ctx.strokeRect(sx, slotY, slotW, slotH);
      });
    };
    drawBoxes(layout.radiantX, temporalRadRef.current, '#38BDF8');
    drawBoxes(layout.direX, temporalDireRef.current, '#E23636');

    syncFromTemporal(myTeam);
  };

  useEffect(() => {
    if (!capturing) return;
    const timer = window.setInterval(scanCurrentFrame, 900);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, myTeam]);

  /** Открывает плавающее окно поверх всех окон (Always-on-Top PiP). */
  const openOverlayWindow = async () => {
    const url = `${window.location.origin}${window.location.pathname}?overlay=1`;
    const anyWin = window as unknown as {
      documentPictureInPicture?: {
        requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
      };
    };
    if (anyWin.documentPictureInPicture) {
      try {
        const pipWin = await anyWin.documentPictureInPicture.requestWindow({ width: 500, height: 740 });
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.background = '#0B0E14';
        const iframe = pipWin.document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';
        pipWin.document.body.appendChild(iframe);
        return;
      } catch {
        /* fallback */
      }
    }
    window.open(url, 'DraftLensOverlay', 'width=500,height=740,menubar=no,toolbar=no,location=no,status=no');
  };

  // --- Добавление игроков в сканер 20 матчей ---
  const addPlayers = (e: FormEvent) => {
    e.preventDefault();
    const lines = input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;

    setSlots((prev) => {
      const next = [...prev];
      for (const raw of lines) {
        if (next.length >= 5) break;
        if (!next.some((s) => s.rawInput.toLowerCase() === raw.toLowerCase())) {
          next.push({ id: `${Date.now()}-${Math.random()}`, rawInput: raw, selectedAccountId: null });
        }
      }
      return next;
    });
    setInput('');
  };

  const loadDemoLobby = () => {
    setSlots([
      { id: 'demo-1', rawInput: '86745912', selectedAccountId: 86745912 },
      { id: 'demo-2', rawInput: '106863163', selectedAccountId: 106863163 },
      { id: 'demo-3', rawInput: '321580662', selectedAccountId: 321580662 },
    ]);
  };

  const activeIds = slots.map((s) => {
    if (s.selectedAccountId) return s.selectedAccountId;
    const p = parseSteamInput(s.rawInput);
    return p.kind === 'id' ? p.accountId : null;
  });

  const matchQueries = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['player', id, 'matches', 20],
      queryFn: () => opendota.playerMatches(id!, 20),
      enabled: !!id,
    })),
  });

  const banTargets: Array<{ heroId: number; games: number; wr: number }> = [];
  matchQueries.forEach((q) => {
    if (!q.data) return;
    const sum = summarizeRecent20(q.data, heroIndex);
    for (const h of sum.topHeroes) {
      if (h.isSpammer) banTargets.push({ heroId: h.heroId, games: h.games, wr: h.wr });
    }
  });
  banTargets.sort((a, b) => b.games - a.games || b.wr - a.wr);

  return (
    <Card
      title="Оверлей поверх игры & Сканер стадии пиков"
      icon={<Radar className="h-3.5 w-3.5 text-primary-bright" />}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Открывает плавающее окно поверх всех окон (Document Picture-in-Picture). Включи в Dota 2 «В окне без рамки», чтобы окно висело прямо поверх стадии пиков!">
            <button
              type="button"
              onClick={openOverlayWindow}
              className="btn-ghost btn-sm border-accent/40 text-accent hover:bg-accent/15"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" /> 📌 Поверх экрана (Оверлей)
            </button>
          </Tooltip>
        </div>
      }
    >
      {/* Переключатель двух режимов сканера */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('screen')}
            className={cn(
              'touch-manipulation flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition',
              mode === 'screen'
                ? 'border-accent bg-accent text-black shadow-glow-cyan'
                : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <Camera className="h-3.5 w-3.5" /> 1. Авто-чтение пиков с экрана Dota 2 (ПК)
          </button>
          <button
            type="button"
            onClick={() => setMode('scout')}
            className={cn(
              'touch-manipulation flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition',
              mode === 'scout'
                ? 'border-primary bg-primary text-white shadow-glow-red'
                : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <Users className="h-3.5 w-3.5" /> 2. Пробив по нику / ID (последние 20 игр)
          </button>
        </div>

        {mode === 'scout' && slots.length === 0 && (
          <button type="button" onClick={loadDemoLobby} className="btn-ghost btn-sm">
            <Sparkles className="h-3.5 w-3.5 text-win-mid" /> Загрузить пример 3 врагов
          </button>
        )}
      </div>

      {/* РЕЖИМ 1: Авто-захват верхней панели экрана Dota 2 (Screen Capture) */}
      {mode === 'screen' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-muted">Твоя сторона в матче:</span>
              <button
                type="button"
                onClick={() => {
                  setMyTeam('radiant');
                  syncFromTemporal('radiant', true);
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-bold transition',
                  myTeam === 'radiant'
                    ? 'border-win-high bg-win-high/15 text-win-high'
                    : 'border-line bg-surface-2 text-fg-muted',
                )}
              >
                Силы Света (Слева)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMyTeam('dire');
                  syncFromTemporal('dire', true);
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-bold transition',
                  myTeam === 'dire'
                    ? 'border-primary bg-primary/15 text-primary-bright'
                    : 'border-line bg-surface-2 text-fg-muted',
                )}
              >
                Силы Тьмы (Справа)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!capturing ? (
                <button type="button" onClick={startCapture} className="btn-primary btn-sm">
                  <Camera className="h-4 w-4" /> Подключить окно Dota 2
                </button>
              ) : (
                <>
                  <button type="button" onClick={scanCurrentFrame} className="btn-ghost btn-sm text-accent">
                    <Scan className="h-4 w-4" /> Сканировать
                  </button>
                  <button type="button" onClick={clearLockedSlots} className="btn-ghost btn-sm text-fg-muted">
                    <RotateCcw className="h-3.5 w-3.5" /> Очистить слоты
                  </button>
                  <button type="button" onClick={stopCapture} className="btn-ghost btn-sm text-win-low">
                    <CameraOff className="h-4 w-4" /> Стоп
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Выбор своего цвета/слота в команде, чтобы твой пик попадал в «ТЫ», а не в «Союзники» */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-fg-muted">Твой слот (цвет):</span>
            <button
              type="button"
              onClick={() => selectMySlot(null)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-2xs font-semibold transition',
                mySlotIdx == null
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
              )}
            >
              Не указан
            </button>
            {TEAM_SLOT_COLORS[myTeam].map((c, idx) => (
              <button
                key={c.name}
                type="button"
                onClick={() => selectMySlot(mySlotIdx === idx ? null : idx)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-bold transition',
                  mySlotIdx === idx
                    ? 'border-win-high bg-win-high/15 text-win-high'
                    : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                )}
                title={`Указать, что игрок #${idx + 1} (${c.name}) — это ты`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.hex }} />
                {idx + 1}·{c.name}
              </button>
            ))}
          </div>

          {captureError && <p className="text-xs text-win-mid">{captureError}</p>}

          <video ref={videoRef} className="hidden" muted playsInline />

          {capturing ? (
            <div className="space-y-2.5 rounded-xl border border-line bg-surface-2/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {activeLayoutName ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-win-high">
                    <CheckCircle2 className="h-4 w-4" /> Распознана раскладка: {activeLayoutName}
                  </span>
                ) : detectedRadiant.some(Boolean) || detectedDire.some(Boolean) ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                    <Clock className="h-4 w-4" /> Кадр HUD скрыт (экран стратегии / загрузки / Alt+Tab) — зафиксированные пики сохранены
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-win-mid">
                    <Clock className="h-4 w-4" /> Ожидание начала стадии пиков (в меню поиска игры слоты отключены)…
                  </span>
                )}
              </div>

              <canvas
                ref={previewCanvasRef}
                className="w-full rounded-lg border border-line bg-black object-contain"
              />

              {/* Интерактивные слоты распознанных героев */}
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                {(['radiant', 'dire'] as const).map((side) => {
                  const isMySide = myTeam === side;
                  const ids = side === 'radiant' ? detectedRadiant : detectedDire;
                  const colors = TEAM_SLOT_COLORS[side];
                  const refSlots = side === 'radiant' ? temporalRadRef : temporalDireRef;
                  return (
                    <div key={side} className="rounded-lg border border-line bg-surface p-2">
                      <div className={cn('mb-1.5 font-bold', side === 'radiant' ? 'text-accent' : 'text-primary-bright')}>
                        {side === 'radiant' ? 'Слева (Radiant)' : 'Справа (Dire)'}
                        {isMySide ? ' · Твоя команда' : ' · Враги'}:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ids.map((id, idx) => {
                          const hero = id ? heroIndex.byId.get(id) : undefined;
                          const isMe = isMySide && mySlotIdx === idx;
                          return hero ? (
                            <div
                              key={idx}
                              className={cn(
                                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-semibold text-fg',
                                isMe
                                  ? 'border-win-high bg-win-high/15'
                                  : side === 'radiant'
                                    ? 'border-accent/40 bg-accent/10'
                                    : 'border-primary/40 bg-primary/10',
                              )}
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[idx].hex }} />
                              <HeroImage hero={hero} variant="icon" className="h-3.5 w-3.5 rounded-sm" />
                              <span>{hero.localized_name}</span>
                              {isMySide && (
                                <button
                                  type="button"
                                  onClick={() => selectMySlot(isMe ? null : idx)}
                                  className={cn(
                                    'rounded px-1 text-[10px] font-bold transition',
                                    isMe ? 'bg-win-high text-black' : 'bg-surface-3 text-fg-muted hover:text-win-high',
                                  )}
                                  title={isMe ? 'Убрать отметку «Это я»' : 'Отметить, что это твой герой'}
                                >
                                  {isMe ? 'ТЫ' : 'Я'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  refSlots.current[idx] = emptyTemporal();
                                  syncFromTemporal(myTeam, true);
                                }}
                                className="text-fg-dim hover:text-win-low"
                                title="Нажми, чтобы пересканировать этот слот"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <span
                              key={idx}
                              className={cn(
                                'inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-2xs',
                                isMe ? 'border-win-high/60 text-win-high' : 'border-line text-fg-dim',
                              )}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors[idx].hex }} />
                              {isMe ? 'ТЫ' : `Слот ${idx + 1}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-fg-muted">
              Нажми <strong>«Подключить окно Dota 2»</strong> и выбери именно окно игры (в режиме «В окне без рамки»).
              Пока идёт поиск игры в меню, сканер молчит и включается только с началом стадии пиков, игнорируя медали рангов
              и ники игроков.
            </p>
          )}
        </div>
      )}

      {/* РЕЖИМ 2: Пробив врагов по никам / Steam ID за последние 20 игр */}
      {mode === 'scout' && (
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={addPlayers} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Введи ники противников или Steam ID через запятую (до 5 игроков)…"
                  className="input py-2 pl-9 text-xs"
                />
              </div>
              <button type="submit" disabled={!input.trim() || slots.length >= 5} className="btn-primary btn-sm py-2">
                <Plus className="h-4 w-4" /> Пробить ({slots.length}/5)
              </button>
            </form>

            {slots.length > 0 && (
              <button type="button" onClick={() => setSlots([])} className="btn-ghost btn-sm text-fg-dim">
                Очистить
              </button>
            )}
          </div>

          {banTargets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-primary-bright">
                <AlertOctagon className="h-4 w-4" /> Главные спам-герои врагов (бан / перехват):
              </span>
              {banTargets.slice(0, 6).map((b, i) => {
                const hero = heroIndex.byId.get(b.heroId);
                return (
                  <button
                    key={`${b.heroId}-${i}`}
                    type="button"
                    onClick={() => onAddEnemyHero(b.heroId)}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/50 bg-bg/90 px-2 py-1 text-xs transition hover:scale-105"
                    title="Нажми, чтобы сразу добавить героя в пик врага и подобрать контрпик"
                  >
                    <HeroImage hero={hero} variant="icon" className="h-4 w-4 rounded-sm" />
                    <span className="font-bold text-white">{hero?.localized_name}</span>
                    <span className="num text-2xs text-primary-bright">
                      ({b.games}/20 игр · {pct(b.wr, 0)})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {slots.length === 0 ? (
            <p className="mt-3 text-xs text-fg-muted">
              Впиши ники противников, которых видишь в начале матча — если у игрока открыт профиль, ты сразу увидишь его
              сигнатурок за последние 20 игр, спамеров 1 героя и тех, кто сейчас на лузстрике.
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {slots.map((slot) => (
                <ScoutPlayerRow
                  key={slot.id}
                  slot={slot}
                  heroIndex={heroIndex}
                  onSelectAccount={(accountId) =>
                    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, selectedAccountId: accountId } : s)))
                  }
                  onRemove={() => setSlots((prev) => prev.filter((s) => s.id !== slot.id))}
                  onPickEnemyHero={onAddEnemyHero}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
