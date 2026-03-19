import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

const stories = [
  { name: 'chat', url: 'http://localhost:6006/iframe.html?id=screens-chat--default&viewMode=story' },
  { name: 'database', url: 'http://localhost:6006/iframe.html?id=screens-database--default&viewMode=story' },
  { name: 'tasks', url: 'http://localhost:6006/iframe.html?id=screens-tasks--default&viewMode=story' },
  { name: 'workflows', url: 'http://localhost:6006/iframe.html?id=screens-workflows--default&viewMode=story' },
  { name: 'settings', url: 'http://localhost:6006/iframe.html?id=screens-settings--default&viewMode=story' },
  { name: 'appshell', url: 'http://localhost:6006/iframe.html?id=layout-appshell--default&viewMode=story' },
]

await mkdir('/tmp/aex-screenshots', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1440, height: 900 })

for (const story of stories) {
  await page.goto(story.url, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `/tmp/aex-screenshots/${story.name}.png`, fullPage: true })
  console.log(`✓ ${story.name}`)
}

await browser.close()
console.log('Done.')
