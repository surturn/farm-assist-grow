import { Request, Response } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ error: 'User ID (uid) is required' });
      return;
    }

    // Ensure upload directory exists
    const avatarsDir = path.join(__dirname, '../../public/avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const filename = `${uid}.webp`;
    const outputPath = path.join(avatarsDir, filename);

    // Process image with Sharp
    // This resizes, crops, converts to webp, and importantly STRIPS all metadata
    // neutralizing any steganography or XSS embedded in EXIF.
    await sharp(req.file.buffer)
      .resize(512, 512, {
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Return the relative URL
    const avatarUrl = `/api/v1/public/avatars/${filename}?t=${Date.now()}`;
    
    // Also update the database if we have a user
    const userId = req.user?.id;
    if (userId) {
      const { prisma } = require('@farmassist/database');
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl }
      });
    }

    res.status(200).json({
      success: true,
      avatarUrl
    });
  } catch (error) {
    console.error('[uploadAvatar] Error processing image:', error);
    res.status(500).json({ error: 'Failed to process and upload avatar' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { region, phone, preferredLanguage, firstName, lastName } = req.body;
    
    const { prisma } = require('@farmassist/database');
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(region && { region }),
        ...(phone && { phone }),
        ...(preferredLanguage && { preferredLanguage }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      }
    });

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[updateProfile] Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
