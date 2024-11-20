let token = localStorage.getItem('token');
let userRole = localStorage.getItem('userRole');

function showHome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <h2>Welcome to Contract Farming</h2>
        <p>Connect farmers and buyers for efficient crop trading.</p>
    `;
}

function showLoginForm() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <h2>Login</h2>
        <form id="login-form">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit">Login</button>
        </form>
        <p id="login-error" class="error"></p>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await axios.post('/login', { username, password });
            token = response.data.token;
            userRole = response.data.role;
            localStorage.setItem('token', token);
            localStorage.setItem('userRole', userRole);
            if (userRole === 'farmer') {
                showFarmerDashboard();
            } else {
                showBuyerDashboard();
            }
        } catch (error) {
            document.getElementById('login-error').textContent = 'Invalid credentials';
        }
    });
}

function showSignupForm() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <h2>Signup</h2>
        <form id="signup-form">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" required>
            </div>
            <div class="form-group">
                <label for="role">Role:</label>
                <select id="role" required>
                    <option value="farmer">Farmer</option>
                    <option value="buyer">Buyer</option>
                </select>
            </div>
            <button type="submit">Signup</button>
        </form>
        <p id="signup-error" class="error"></p>
    `;

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;

        try {
            await axios.post('/signup', { username, password, role });
            showLoginForm();
        } catch (error) {
            document.getElementById('signup-error').textContent = 'Error creating user';
        }
    });
}

function showFarmerDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <h2>Farmer Dashboard</h2>
        <h3>Upload Crop Details</h3>
        <form id="crop-form" enctype="multipart/form-data">
            <div class="form-group">
                <label for="crop-name">Crop Name:</label>
                <input type="text" id="crop-name" name="name" required>
            </div>
            <div class="form-group">
                <label for="crop-description">Description:</label>
                <textarea id="crop-description" name="description" required></textarea>
            </div>
            <div class="form-group">
                <label for="crop-location">Location:</label>
                <input type="text" id="crop-location" name="location" required>
            </div>
            <div class="form-group">
                <label for="crop-price">Price per kg:</label>
                <input type="number" id="crop-price" name="price" step="0.01" required>
            </div>
            <div class="form-group">
                <label for="crop-image">Image:</label>
                <input type="file" id="crop-image" name="image" accept="image/*">
            </div>
            <button type="submit">Upload Crop</button>
        </form>
        <p id="crop-error" class="error"></p>
    `;

    document.getElementById('crop-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await axios.post('/crops', formData, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Crop added successfully');
            e.target.reset();
        } catch (error) {
            document.getElementById('crop-error').textContent = 'Error adding crop';
        }
    });
}

async function showBuyerDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <h2>Buyer Dashboard</h2>
        <div id="crops-list"></div>
        <p id="crops-error" class="error"></p>
    `;

    try {
        const response = await axios.get('/crops', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const crops = response.data;
        const cropsList = document.getElementById('crops-list');

        crops.forEach(crop => {
            const cropCard = document.createElement('div');
            cropCard.className = 'crop-card';
            cropCard.innerHTML = `
                <h3>${crop.name}</h3>
                <p>${crop.description}</p>
                <p>Location: ${crop.location}</p>
                <p>Price: $${crop.price} per kg</p>
                <p>Farmer: ${crop.farmer}</p>
                ${crop.image ? `<img src="${crop.image}" alt="${crop.name}" style="max-width: 200px;">` : ''}
                <button onclick="buyCrop('${crop.id}')">Buy Crop</button>
            `;
            cropsList.appendChild(cropCard);
        });
    } catch (error) {
        console.error('Error fetching crops:', error);
        document.getElementById('crops-error').textContent = 'Error fetching crops';
    }
}

async function buyCrop(cropId) {
    try {
        const response = await axios.get(`/generate-contract/${cropId}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `contract-${cropId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error('Error generating contract:', error);
        alert('Error generating contract. Please try again.');
    }
}

document.getElementById('home-link').addEventListener('click', showHome);
document.getElementById('login-link').addEventListener('click', showLoginForm);
document.getElementById('signup-link').addEventListener('click', showSignupForm);

// Initial page load
if (token && userRole) {
    if (userRole === 'farmer') {
        showFarmerDashboard();
    } else {
        showBuyerDashboard();
    }
} else {
    showHome();
}