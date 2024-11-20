import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const SECRET_KEY = 'your-secret-key';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

async function readJSONFile(filename) {
  const data = await fs.readFile(path.join(__dirname, filename), 'utf8');
  return JSON.parse(data);
}

async function writeJSONFile(filename, data) {
  await fs.writeFile(path.join(__dirname, filename), JSON.stringify(data, null, 2));
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/signup', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const users = await readJSONFile('users.json');
    
    if (users.find(user => user.username === username)) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword, role });
    await writeJSONFile('users.json', users);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await readJSONFile('users.json');
    const user = users.find(user => user.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY);
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.post('/crops', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can upload crops' });
    }

    const crops = await readJSONFile('crops.json');
    const newCrop = {
      id: uuidv4(),
      name: req.body.name,
      description: req.body.description,
      location: req.body.location,
      price: parseFloat(req.body.price),
      farmer: req.user.username,
      image: req.file ? `/uploads/${req.file.filename}` : null
    };
    crops.push(newCrop);
    await writeJSONFile('crops.json', crops);

    res.status(201).json({ message: 'Crop added successfully', crop: newCrop });
  } catch (error) {
    console.error('Error adding crop:', error);
    res.status(500).json({ message: 'Error adding crop', error: error.message });
  }
});

app.get('/crops', authenticateToken, async (req, res) => {
  try {
    const crops = await readJSONFile('crops.json');
    res.json(crops);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching crops' });
  }
});

app.get('/generate-contract/:cropId', authenticateToken, async (req, res) => {
    try {
      const crops = await readJSONFile('crops.json');
      const crop = crops.find(c => c.id === req.params.cropId);
  
      if (!crop) {
        return res.status(404).json({ message: 'Crop not found' });
      }
  
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=contract-${crop.id}.pdf`);
  
      doc.pipe(res);
  
      // Title
      doc.fontSize(18).text('Contract Farming Agreement', { align: 'center', underline: true });
      doc.moveDown(2);
  
      // Date
      doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();
  
      // Parties Involved
      doc.fontSize(14).text('PARTIES INVOLVED', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Buyer: ${req.user.username}`);
      doc.text(`Farmer: ${crop.farmer}`);
      doc.text('This agreement is entered into by the aforementioned parties for the purpose of purchasing agricultural produce as described below.');
      doc.moveDown(2);
  
      // Crop Details
      doc.fontSize(14).text('CROP DETAILS', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Crop Name: ${crop.name}`);
      doc.text(`Description: ${crop.description}`);
      doc.text(`Location: ${crop.location}`);
      doc.text(`Price: ${crop.price} per kg`);
      doc.text(`Total Quantity: ${crop.quantity} kg`);
      doc.text(`Total Price: ${crop.price * crop.quantity} USD`);
      doc.moveDown(2);
  
      // Terms and Conditions
      doc.fontSize(14).text('TERMS AND CONDITIONS', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text('1. The buyer agrees to purchase the crop as per the details mentioned above.');
      doc.text('2. The farmer guarantees that the crop will meet the agreed-upon quality standards and will be delivered at the specified location.');
      doc.text('3. Payment will be made upon delivery and verification of the crop.');
      doc.text('4. Any disputes arising from this agreement shall be resolved as per the applicable agricultural laws of the region.');
      doc.moveDown();
  
      // Legal Requirements
      doc.fontSize(14).text('LEGAL REQUIREMENTS', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text('This agreement complies with the legal framework established for contract farming under the applicable agricultural and trade laws. Both parties are advised to read and understand the terms before signing.');
      doc.text('1. The buyer and farmer must adhere to all government regulations regarding the sale and purchase of agricultural produce.');
      doc.text('2. This document is a legally binding contract, and any violation of its terms may result in legal action.');
      doc.text('3. The farmer must ensure that the crop is free from pests, diseases, and harmful substances.');
      doc.text('4. The buyer must ensure timely payment as per the agreed terms.');
      doc.moveDown();
  
      // Signatures
      doc.fontSize(14).text('SIGNATURES', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text('Farmer Signature:', { continued: true });
      doc.text(' __________________________', { align: 'right' });
      doc.moveDown(3);
      doc.text('Buyer Signature:', { continued: true });
      doc.text(' __________________________', { align: 'right' });
      doc.moveDown(2);
  
      // Footer
      doc.fontSize(10).text('This agreement is generated electronically and does not require a physical seal.', { align: 'center' });
  
      doc.end();
    } catch (error) {
      console.error('Error generating contract:', error);
      res.status(500).json({ message: 'Error generating contract', error: error.message });
    }
  });
  

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});