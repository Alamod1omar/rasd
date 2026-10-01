import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ غير متوقع في النظام، يرجى المحاولة لاحقاً';
    let code = 'INTERNAL_SERVER_ERROR';
    let errors = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const anyRes = res as any;
        message = anyRes.message || message;
        code = anyRes.code || code;
        errors = anyRes.errors || (Array.isArray(anyRes.message) ? anyRes.message : null);

        if (Array.isArray(anyRes.message)) {
          message = anyRes.message.join(' - ');
        }
      }
    } else if (exception instanceof Error) {
      // Prisma or DB error handling
      const errStr = exception.message || '';
      if (errStr.includes('Unique constraint failed')) {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_ENTRY';
        message = 'هذا السجل موجود مسبقاً في النظام ولا يمكن تكراره';
      } else if (errStr.includes('Foreign key constraint failed')) {
        status = HttpStatus.BAD_REQUEST;
        code = 'FOREIGN_KEY_VIOLATION';
        message = 'لا يمكن تنفيذ العملية لوجود بيانات مرتبطة بهذا السجل';
      } else {
        console.error('Unhandled Exception in filter:', exception);
      }
    } else {
      console.error('Non-error thrown in filter:', exception);
    }

    // Map common HTTP status codes to friendly Arabic
    if (status === HttpStatus.UNAUTHORIZED) {
      code = code === 'INTERNAL_SERVER_ERROR' ? 'UNAUTHORIZED' : code;
      message = message === 'Unauthorized' ? 'جلسة العمل غير صالحة أو منتهية، يرجى تسجيل الدخول' : message;
    } else if (status === HttpStatus.FORBIDDEN) {
      code = code === 'INTERNAL_SERVER_ERROR' ? 'FORBIDDEN' : code;
      message = message === 'Forbidden resource' ? 'ليس لديك الصلاحية لتنفيذ هذا الإجراء' : message;
    } else if (status === HttpStatus.NOT_FOUND) {
      code = code === 'INTERNAL_SERVER_ERROR' ? 'NOT_FOUND' : code;
    }

    response.status(status).json({
      success: false,
      code,
      message,
      errors,
    });
  }
}
