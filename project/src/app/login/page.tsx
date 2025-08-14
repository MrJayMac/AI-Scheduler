'use client'

import AuthForm from '@/app/components/AuthForm'
import styles from './login.module.css'

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.cardWrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.grad}>AI Scheduler</span>
          </h1>
          <p className={styles.subtitle}>Plan smarter. Flow faster.</p>
        </div>

        <div className={styles.authCard}>
          <AuthForm />
        </div>
      </div>
    </main>
  )
}
