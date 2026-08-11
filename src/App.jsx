import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import RitualStrip from './components/RitualStrip'
import MenuSection from './components/MenuSection'
import AboutSection from './components/AboutSection'
import VisitSection from './components/VisitSection'
import FaqSection from './components/FaqSection'
import FeedbackSection from './components/FeedbackSection'
import ContactSection from './components/ContactSection'
import Footer from './components/Footer'
import SugarModal from './components/SugarModal'
import CartModal from './components/CartModal'
import CartFab from './components/CartFab'
import BackToTop from './components/BackToTop'
import { useCart } from './hooks/useCart'

export default function App() {
  const cart = useCart()
  const [sugarModalDrink, setSugarModalDrink] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [bumpKey, setBumpKey] = useState(0)

  function handleAddToCart(drinkKey, name, level, milk, unitPrice, qty) {
    cart.addToCart(drinkKey, name, level, milk, unitPrice, qty)
    setBumpKey((k) => k + 1)
  }

  return (
    <>
      <Header cartCount={cart.cartCount} bumpKey={bumpKey} onOpenCart={() => setIsCartOpen(true)} />
      <main>
        <Hero />
        <RitualStrip />
        <MenuSection onOpenSugarModal={setSugarModalDrink} />
        <AboutSection />
        <VisitSection />
        <FaqSection />
        <FeedbackSection />
        <ContactSection />
      </main>
      <Footer />

      <SugarModal drink={sugarModalDrink} onClose={() => setSugarModalDrink(null)} onAddToCart={handleAddToCart} />
      <CartModal
        isOpen={isCartOpen}
        cart={cart.cart}
        orderNumber={cart.orderNumber}
        cartTotal={cart.cartTotal}
        onClose={() => setIsCartOpen(false)}
        onChangeQty={cart.changeQty}
        onRemove={cart.removeItem}
        onClearAll={cart.clearAll}
      />
      <CartFab
        cartCount={cart.cartCount}
        cartTotal={cart.cartTotal}
        bumpKey={bumpKey}
        onOpenCart={() => setIsCartOpen(true)}
      />
      <BackToTop />
    </>
  )
}
