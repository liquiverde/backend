import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const BARCODE_PATTERN = /^\d{8,14}$/;

@Injectable()
export class ParseBarcodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!BARCODE_PATTERN.test(value)) {
      throw new BadRequestException('code must be 8-14 digits (EAN/UPC)');
    }
    return value;
  }
}
