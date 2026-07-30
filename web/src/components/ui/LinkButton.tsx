import { Link, type LinkProps } from 'react-router-dom'
import styles from './Button.module.css'

interface LinkButtonProps extends LinkProps {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function LinkButton({ variant = 'primary', className, ...rest }: LinkButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return <Link className={classes} {...rest} />
}
