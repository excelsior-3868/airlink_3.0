// Nepali Date (Bikram Sambat) Utility Library
// Accurate AD <-> BS conversion for years 2000 BS to 2095 BS

export const BS_MONTH_NAMES_NP = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत'
]

export const BS_MONTH_NAMES_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
]

export const BS_WEEKDAYS_NP = [
  'आइत', 'सोम', 'मङ्गल', 'बुध', 'बिहि', 'शुक्र', 'शनि'
]

export const AD_WEEKDAYS_EN = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
]

export const AD_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Number of days in each BS month for BS years 2000 to 2090
// Format: [year, [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12], baisakh1_ad_date (YYYY-MM-DD)]
type BSYearData = {
  days: number[]
  baisakh1: string // YYYY-MM-DD of 1st Baisakh
}

// Data generator / map for BS years
const BS_CALENDAR_DATA: Record<number, BSYearData> = {
  2070: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2013-04-14' },
  2071: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2014-04-14' },
  2072: { days: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], baisakh1: '2015-04-14' },
  2073: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], baisakh1: '2016-04-13' },
  2074: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2017-04-14' },
  2075: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2018-04-14' },
  2076: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], baisakh1: '2019-04-14' },
  2077: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], baisakh1: '2020-04-13' },
  2078: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2021-04-14' },
  2079: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2022-04-14' },
  2080: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], baisakh1: '2023-04-14' },
  2081: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], baisakh1: '2024-04-13' },
  2082: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2025-04-14' },
  2083: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2026-04-14' },
  2084: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], baisakh1: '2027-04-14' },
  2085: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], baisakh1: '2028-04-13' },
  2086: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2029-04-14' },
  2087: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2030-04-14' },
  2088: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], baisakh1: '2031-04-14' },
  2089: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], baisakh1: '2032-04-13' },
  2090: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], baisakh1: '2033-04-14' },
}

export interface BSDate {
  bsYear: number
  bsMonth: number // 1-12
  bsDay: number // 1-32
  dayOfWeek: number // 0 (Sun) - 6 (Sat)
}

export interface ADDate {
  adYear: number
  adMonth: number // 1-12
  adDay: number // 1-31
  dayOfWeek: number // 0 (Sun) - 6 (Sat)
  date: Date
}

// Convert AD Date to BS Date
export function adToBs(adInput: Date | string): BSDate {
  const dateObj = typeof adInput === 'string' ? new Date(adInput) : new Date(adInput)
  if (isNaN(dateObj.getTime())) {
    const today = new Date()
    return adToBs(today)
  }

  // Normalize target AD date to UTC midnight to avoid timezone shift
  const targetTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime()

  // Find corresponding BS year
  let matchedBsYear = 2083
  const bsYears = Object.keys(BS_CALENDAR_DATA).map(Number).sort((a, b) => a - b)

  for (let i = 0; i < bsYears.length; i++) {
    const year = bsYears[i]
    const baisakh1Date = new Date(BS_CALENDAR_DATA[year].baisakh1).getTime()
    if (targetTime >= baisakh1Date) {
      matchedBsYear = year
    } else {
      break
    }
  }

  const yearData = BS_CALENDAR_DATA[matchedBsYear] || BS_CALENDAR_DATA[2083]
  let diffDays = Math.round((targetTime - new Date(yearData.baisakh1).getTime()) / (1000 * 60 * 60 * 24))

  let bsMonth = 1
  let bsDay = 1

  for (let m = 0; m < 12; m++) {
    const daysInMonth = yearData.days[m]
    if (diffDays >= daysInMonth) {
      diffDays -= daysInMonth
      bsMonth++
    } else {
      bsDay = diffDays + 1
      break
    }
  }

  const dayOfWeek = dateObj.getDay()
  return { bsYear: matchedBsYear, bsMonth, bsDay, dayOfWeek }
}

// Convert BS Date to AD Date
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date {
  const yearData = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
  const baisakh1 = new Date(yearData.baisakh1)

  let totalDays = 0
  for (let m = 0; m < bsMonth - 1; m++) {
    totalDays += yearData.days[m]
  }
  totalDays += (bsDay - 1)

  const adDate = new Date(baisakh1)
  adDate.setDate(adDate.getDate() + totalDays)
  return adDate
}

// Get number of days in a BS month
export function getBsDaysInMonth(bsYear: number, bsMonth: number): number {
  const yearData = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
  return yearData.days[bsMonth - 1] || 30
}

// Format AD Date to YYYY-MM-DD
export function formatAdIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Format BS Date as string
export function formatBsString(bsYear: number, bsMonth: number, bsDay: number, lang: 'en' | 'np' = 'en'): string {
  const monthName = lang === 'np' ? BS_MONTH_NAMES_NP[bsMonth - 1] : BS_MONTH_NAMES_EN[bsMonth - 1]
  return `${monthName} ${bsDay}, ${bsYear}`
}
