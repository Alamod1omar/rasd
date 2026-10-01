import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates safe sequential document number inside an existing or new Prisma transaction
   */
  async getNextDocumentNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
    type: 'SALES' | 'SHORTAGE',
  ): Promise<string> {
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = type === 'SALES' ? 'SL' : 'SH';

    // Atomic increment using Prisma upsert in transaction
    const sequence = await tx.documentSequence.upsert({
      where: {
        companyId_branchId_type_dateKey: {
          companyId,
          branchId,
          type,
          dateKey,
        },
      },
      update: {
        lastNumber: {
          increment: 1,
        },
      },
      create: {
        companyId,
        branchId,
        type,
        prefix,
        dateKey,
        lastNumber: 1,
      },
    });

    let currentNum = sequence.lastNumber;
    let candidate = `${prefix}-${dateKey}-${String(currentNum).padStart(3, '0')}`;

    // Verify if candidate already exists in table (e.g. from seeds or previous runs)
    let exists = true;
    while (exists) {
      if (type === 'SALES') {
        const found = await tx.salesRequest.findUnique({
          where: { documentNumber: candidate },
          select: { id: true },
        });
        if (!found) {
          exists = false;
          break;
        }
      } else {
        const found = await tx.shortageRequest.findUnique({
          where: { documentNumber: candidate },
          select: { id: true },
        });
        if (!found) {
          exists = false;
          break;
        }
      }

      currentNum += 1;
      candidate = `${prefix}-${dateKey}-${String(currentNum).padStart(3, '0')}`;
      await tx.documentSequence.update({
        where: { id: sequence.id },
        data: { lastNumber: currentNum },
      });
    }

    return candidate;
  }
}
