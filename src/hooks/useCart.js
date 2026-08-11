import { useCallback, useEffect, useState } from 'react'

const CART_STORAGE_KEY = 'mori-matcha-cart'
const ORDER_NUMBER_KEY = 'mori-matcha-order-number'

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch (e) {
    return []
  }
}

function readOrderNumber() {
  try {
    return localStorage.getItem(ORDER_NUMBER_KEY) || null
  } catch (e) {
    return null
  }
}

function generateOrderNumber() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const map = {}
  fmt.formatToParts(new Date()).forEach((p) => {
    map[p.type] = p.value
  })
  const hour = map.hour === '24' ? '00' : map.hour
  return 'MM-' + map.month + map.day + '-' + hour + map.minute
}

export function useCart() {
  const [cart, setCart] = useState(readCart)
  const [orderNumber, setOrderNumber] = useState(readOrderNumber)

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    } catch (e) {
      // ignore — cart still works in-memory for this session
    }
  }, [cart])

  useEffect(() => {
    try {
      if (orderNumber) localStorage.setItem(ORDER_NUMBER_KEY, orderNumber)
      else localStorage.removeItem(ORDER_NUMBER_KEY)
    } catch (e) {
      // ignore
    }
  }, [orderNumber])

  const ensureOrderNumber = useCallback(() => {
    let current = orderNumber
    if (!current) {
      current = generateOrderNumber()
      setOrderNumber(current)
    }
    return current
  }, [orderNumber])

  const addToCart = useCallback((drinkKey, name, level, milk, unitPrice, qty) => {
    ensureOrderNumber()
    setCart((prev) => {
      const existing = prev.find((i) => i.drinkKey === drinkKey && i.level === level && i.milk === milk)
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, qty: i.qty + qty } : i))
      }
      return [
        ...prev,
        {
          id: drinkKey + '|' + level + '|' + milk + '|' + Date.now(),
          drinkKey,
          name,
          level,
          milk,
          unitPrice,
          qty,
        },
      ]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeItem = useCallback((id) => {
    setCart((prev) => {
      const next = prev.filter((i) => i.id !== id)
      if (next.length === 0) setOrderNumber(null)
      return next
    })
  }, [])

  const changeQty = useCallback(
    (id, delta) => {
      setCart((prev) => {
        const item = prev.find((i) => i.id === id)
        if (!item) return prev
        const nextQty = item.qty + delta
        if (nextQty <= 0) {
          const next = prev.filter((i) => i.id !== id)
          if (next.length === 0) setOrderNumber(null)
          return next
        }
        return prev.map((i) => (i.id === id ? { ...i, qty: nextQty } : i))
      })
    },
    [],
  )

  const clearAll = useCallback(() => {
    setCart([])
    setOrderNumber(null)
  }, [])

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  return {
    cart,
    orderNumber,
    ensureOrderNumber,
    addToCart,
    removeItem,
    changeQty,
    clearAll,
    cartTotal,
    cartCount,
  }
}
