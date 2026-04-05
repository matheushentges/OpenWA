import { Injectable, InternalServerErrorException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import type { PDFOptions } from 'puppeteer';

export interface PdfRenderRequest {
  html: string;
  documentKey?: string;
  pdfOptions?: {
    format?: string;
    preferCSSPageSize?: boolean;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  };
}

@Injectable()
export class PdfService {
  async renderPdf(input: PdfRenderRequest): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: this.parseHeadless(),
      args: this.parseArgs(),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
      await page.emulateMediaType('screen');
      await page.setContent(input.html, {
        waitUntil: 'networkidle0',
        timeout: 45_000,
      });
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
              setTimeout(() => resolve(), 8_000);
            });
          }),
        );
      });

      const pdf = await page.pdf({
        format: (input.pdfOptions?.format || 'A4') as PDFOptions['format'],
        printBackground: input.pdfOptions?.printBackground ?? true,
        preferCSSPageSize: input.pdfOptions?.preferCSSPageSize ?? true,
        margin: input.pdfOptions?.margin,
      });

      return Buffer.from(pdf);
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Failed to render PDF');
    } finally {
      await browser.close();
    }
  }

  private parseHeadless(): boolean | 'shell' {
    const raw = (process.env.PDF_RENDERER_HEADLESS || process.env.PUPPETEER_HEADLESS || 'true').trim().toLowerCase();
    if (raw === 'shell') return 'shell';
    return raw !== 'false';
  }

  private parseArgs(): string[] {
    const raw = (process.env.PDF_RENDERER_ARGS || process.env.PUPPETEER_ARGS || '').trim();
    if (!raw) {
      return ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    }
    return raw
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
}
