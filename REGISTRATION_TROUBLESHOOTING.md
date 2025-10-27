# Registration Troubleshooting Guide

## ✅ Backend Status: WORKING
The auth service is functioning correctly and accepting registrations.

## 🔍 Common Issues & Solutions

### 1. **Password Requirements Not Met** (Most Common!)

Your password MUST include ALL of these:
- ✅ At least 8 characters
- ✅ At least one UPPERCASE letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one special character: `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`

**❌ Invalid passwords:**
- `password` - no uppercase, no number, no special char
- `Password123` - no special character
- `Pass123!` - less than 8 characters
- `PASSWORD123!` - no lowercase

**✅ Valid passwords:**
- `MyP@ssw0rd!`
- `SecurePass123!`
- `TestUser2024#`
- `Welcome@123`

### 2. **Browser Cache Issue**

If you're still seeing the error after fixes:
1. **Hard refresh the page:** 
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`
2. **Clear browser cache**
3. **Open in incognito/private window**

### 3. **Check Browser Console**

Open Developer Tools (F12) and check the Console tab for specific errors:
- Look for network errors (red text)
- Check the Network tab for the `/auth/register` request
- See what the actual error message says

### 4. **Service Not Running**

Verify services are running:
```bash
# Check auth service (should show process on port 3001)
lsof -i :3001

# Check frontend (should show process on port 5173)
lsof -i :5173

# Test backend directly
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}'
```

## 🧪 Test Registration Step-by-Step

### Option 1: Use the Web UI
1. Go to: http://localhost:5173 (or your frontend URL)
2. Click "Sign Up" tab
3. Fill in the form:
   - **Name:** Your Full Name
   - **Email:** yourname@example.com
   - **Password:** `SecurePass123!` (or similar that meets requirements)
   - **Confirm Password:** Same as above
4. Click "Create Account"
5. You should be redirected to dashboard

### Option 2: Test with curl (to verify backend)
```bash
curl -v -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"mytest@example.com",
    "password":"ValidPass123!",
    "name":"My Test User"
  }'
```

**Expected response:** 201 Created with access token and user info

## 🔴 Still Getting Errors?

### Check the exact error message:

1. **"Password must contain..."**
   - Your password doesn't meet requirements
   - See section 1 above

2. **"User with this email already exists"**
   - Try a different email address
   - Email must be unique

3. **"Registration failed. Please try again."**
   - This is a generic error
   - Open browser console (F12) to see the actual error
   - Check the Network tab to see the response

4. **Network error / CORS error**
   - Service might be restarting
   - Wait 5 seconds and try again

5. **"Validation error"**
   - Check that email is valid format
   - Check that name is at least 2 characters
   - Check that password meets all requirements

## 📋 Pre-flight Checklist

Before trying to register, verify:

- [ ] PostgreSQL is running: `docker ps | grep postgres`
- [ ] Auth service is running: `lsof -i :3001`
- [ ] Frontend is running: `lsof -i :5173`
- [ ] You can access frontend: http://localhost:5173
- [ ] Password meets ALL requirements (see section 1)
- [ ] Email is in valid format (contains @)
- [ ] Name is at least 2 characters
- [ ] Passwords match (password and confirm password)

## 🎯 Quick Working Example

If you want to test with a password that definitely works:

```
Name: John Doe
Email: john.doe@example.com
Password: Welcome@2024!
Confirm: Welcome@2024!
```

This password has:
- ✅ 13 characters (more than 8)
- ✅ Uppercase: W
- ✅ Lowercase: elcome
- ✅ Number: 2, 0, 2, 4
- ✅ Special: @, !

## 💡 Debug Commands

```bash
# Check if services are running
ps aux | grep -E "(auth-service|workflow-designer)" | grep -v grep

# Test auth service directly
curl http://localhost:3001/health

# View auth service logs (if running in terminal)
# Look at the terminal where you ran `pnpm run dev`

# Test with verbose curl to see headers
curl -v -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"debug@test.com","password":"Debug@123!","name":"Debug User"}'
```

## 🆘 Still Stuck?

1. **Take a screenshot** of:
   - The browser console (F12 → Console tab)
   - The network tab showing the failed request
   - The actual error message on screen

2. **Share the output** of:
   ```bash
   curl http://localhost:3001/health
   curl -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"help@test.com","password":"HelpMe@123!","name":"Help User"}'
   ```

3. **Check if frontend has the latest code:**
   - Look at the hint text under the password field
   - It should say: "Must be 8+ characters with uppercase, lowercase, number, and special character"
   - If you don't see this, refresh with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

