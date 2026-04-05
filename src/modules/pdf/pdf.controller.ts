import { Body, Controller, Headers, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/auth.decorators';
import type { PdfRenderRequest } from './pdf.service';
import { PdfService } from './pdf.service';

@ApiExcludeController()
@Controller('internal/pdf')
@Public()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('render')
  @HttpCode(200)
  async renderPdf(
    @Body() body: PdfRenderRequest,
    @Headers('x-internal-pdf-secret') secret: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const expectedSecret = process.env.PDF_RENDERER_SECRET?.trim();
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal PDF secret');
    }

    const pdf = await this.pdfService.renderPdf(body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.send(pdf);
  }
}
