import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { EmailService } from '../services/email-service';
import { EmailRequest, EmailTemplate } from '../types/email-types';
import { logger } from '../utils/logger';
import { getEmailConfig } from '../config/email-config';

const router = Router();
const emailService = new EmailService();
const config = getEmailConfig();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Send email
router.post('/send', upload.array('attachments', 10), async (req: Request, res: Response) => {
  try {
    const emailRequest: EmailRequest = {
      to: Array.isArray(req.body.to) ? req.body.to : [req.body.to],
      cc: req.body.cc ? (Array.isArray(req.body.cc) ? req.body.cc : [req.body.cc]) : undefined,
      bcc: req.body.bcc ? (Array.isArray(req.body.bcc) ? req.body.bcc : [req.body.bcc]) : undefined,
      subject: req.body.subject,
      templateId: req.body.templateId,
      templateVariables: req.body.templateVariables
        ? JSON.parse(req.body.templateVariables)
        : undefined,
      htmlContent: req.body.htmlContent,
      textContent: req.body.textContent,
      organizationId: req.body.organizationId,
      priority: req.body.priority || 'normal',
      trackOpens: req.body.trackOpens === 'true',
      trackClicks: req.body.trackClicks === 'true',
      attachments: req.files
        ? (req.files as Express.Multer.File[]).map((file) => ({
            filename: file.originalname,
            path: file.path,
            contentType: file.mimetype,
          }))
        : undefined,
    };

    const result = await emailService.sendEmail(emailRequest);

    res.json({
      success: result.status === 'sent',
      messageId: result.messageId,
      status: result.status,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Email send API error', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Create email template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const templateData = {
      name: req.body.name,
      subject: req.body.subject,
      htmlContent: req.body.htmlContent,
      textContent: req.body.textContent,
      organizationId: req.body.organizationId,
      variables: [], // Will be extracted automatically
    };

    const template = await emailService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      template,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Template creation API error', { error: errorMessage });
    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Get email templates
router.get('/templates/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const templates = await emailService.getTemplates(organizationId);

    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get templates API error', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Get specific template
router.get('/templates/:organizationId/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = await emailService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get template API error', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Update email template
router.put('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const updates = {
      name: req.body.name,
      subject: req.body.subject,
      htmlContent: req.body.htmlContent,
      textContent: req.body.textContent,
    };

    const template = await emailService.updateTemplate(templateId, updates);

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Template update API error', { error: errorMessage });
    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Delete email template
router.delete('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    await emailService.deleteTemplate(templateId);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Template deletion API error', { error: errorMessage });
    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Get delivery status
router.get('/status/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const status = await emailService.getDeliveryStatus(messageId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Delivery status not found',
      });
    }

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get delivery status API error', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Get email metrics
router.get('/metrics/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const metrics = await emailService.getEmailMetrics(
      organizationId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get metrics API error', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isConnected = await emailService.verifyConnection();

    res.json({
      success: true,
      status: 'healthy',
      smtp: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
