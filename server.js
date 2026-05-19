const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

app.get('/api/groups', async (req, res) => {
    const { data, error } = await db.from('groups').select('*').order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.post('/api/groups', async (req, res) => {
    const { name } = req.body
    const { data, error } = await db.from('groups').insert([{ name }]).select()
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.delete('/api/groups/:id', async (req, res) => {
    const { error } = await db.from('groups').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error })
    res.json({ success: true })
})

app.get('/api/members/:groupId', async (req, res) => {
    const { data, error } = await db.from('members').select('*').eq('group_id', req.params.groupId)
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.post('/api/members', async (req, res) => {
    const { group_id, name } = req.body
    const { data, error } = await db.from('members').insert([{ group_id, name }]).select()
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.delete('/api/members/:id', async (req, res) => {
    const { error } = await db.from('members').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error })
    res.json({ success: true })
})

app.get('/api/expenses/:groupId', async (req, res) => {
    const { data, error } = await db.from('expenses').select('*').eq('group_id', req.params.groupId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.post('/api/expenses', async (req, res) => {
    const { group_id, description, amount, category, paid_by, split_method, split_data } = req.body
    const { data, error } = await db.from('expenses').insert([{ group_id, description, amount, category, paid_by, split_method, split_data }]).select()
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.delete('/api/expenses/:id', async (req, res) => {
    const { error } = await db.from('expenses').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error })
    res.json({ success: true })
})

app.get('/api/messages/:groupId', async (req, res) => {
    const { data, error } = await db.from('messages').select('*').eq('group_id', req.params.groupId).order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.post('/api/messages', async (req, res) => {
    const { group_id, sender, text, type } = req.body
    const { data, error } = await db.from('messages').insert([{ group_id, sender, text, type }]).select()
    if (error) return res.status(500).json({ error })
    res.json(data)
})

app.listen(process.env.PORT, () => {
    console.log('Server started on port ' + process.env.PORT)
})