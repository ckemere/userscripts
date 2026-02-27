// ==UserScript==
// @name         Amazon US Invoice Download All
// @icon         https://www.amazon.com/favicon.ico
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @description  Open all invoices for printing/PDF on US Amazon
// @author       HR (modified for US)
// @match        *://*.amazon.com/your-orders/*
// @match        *://*.amazon.com/gp/your-account/order-history*
// @match        *://*.amazon.com/gp/css/order-history*
// @grant        none
// ==/UserScript==

;(function () {
  'use strict'

  // Wait for page to fully load
  $(document).ready(function () {
    const downloadButton = `
      <div id="downloadInvoicesContainer" style="margin: 10px 0; text-align: right;">
        <span id="downloadInvoicesButton" class="a-declarative">
          <span class="a-button a-button-primary" id="a-autoid-invoice-dl">
            <span class="a-button-inner">
              <span class="a-button-text" role="button">
                Open All Invoices
              </span>
            </span>
          </span>
        </span>
        <span id="printInvoicesButton" class="a-declarative" style="margin-left: 8px;">
          <span class="a-button a-button-normal" id="a-autoid-invoice-print">
            <span class="a-button-inner">
              <span class="a-button-text" role="button">
                Print All Invoices (sequential)
              </span>
            </span>
          </span>
        </span>
      </div>`

    // Insert button after the search/filter bar area
    $('.a-box.order-header').first().closest('.order-card').before(downloadButton)

    // Collect all invoice URLs from the page
    function getInvoiceLinks () {
      const invoices = []
      $('.order-card').each(function () {
        const card = $(this)

        // Extract order ID
        const orderIdText = card.find('.yohtmlc-order-id .a-color-secondary[dir="ltr"]').text().trim()
          || card.find('.yohtmlc-order-id').text().replace(/Order\s*#/i, '').trim()

        // Extract order date
        const orderDate = card.find('.order-header .a-color-secondary.aok-break-word').first().text().trim()

        // Extract total
        const orderTotal = card.find('.order-header .a-color-secondary.aok-break-word').eq(1).text().trim()

        // Find the "View invoice" link
        let invoiceUrl = null
        card.find('a.a-link-normal').each(function () {
          const linkText = $(this).text().trim().toLowerCase()
          if (linkText.includes('invoice')) {
            invoiceUrl = $(this).attr('href')
            if (invoiceUrl && !invoiceUrl.startsWith('http')) {
              invoiceUrl = window.location.origin + invoiceUrl
            }
          }
        })

        if (invoiceUrl && orderIdText) {
          invoices.push({
            orderId: orderIdText,
            date: orderDate,
            total: orderTotal,
            url: invoiceUrl,
            filename: `${orderDate} ${orderIdText} ${orderTotal}.pdf`.replace(/[/\\?%*:|"<>]/g, '-')
          })
        }
      })
      return invoices
    }

    // Option 1: Open all invoices in new tabs
    $('#downloadInvoicesButton').click(function () {
      const invoices = getInvoiceLinks()
      if (invoices.length === 0) {
        alert('No invoices found on this page.')
        return
      }
      const proceed = confirm(`Found ${invoices.length} invoice(s). Open all in new tabs?\n\nYou can then print each to PDF using Ctrl+P > "Save to PDF".`)
      if (!proceed) return

      invoices.forEach((inv, i) => {
        // Stagger opening to avoid popup blockers
        setTimeout(() => {
          window.open(inv.url, '_blank')
        }, i * 500)
      })
    })

    // Option 2: Sequential print using hidden iframe
    $('#printInvoicesButton').click(async function () {
      const invoices = getInvoiceLinks()
      if (invoices.length === 0) {
        alert('No invoices found on this page.')
        return
      }
      const proceed = confirm(
        `Found ${invoices.length} invoice(s). This will open the Firefox print dialog for each one sequentially.\n\n` +
        `In the print dialog, select "Save to PDF" as your printer.\n\nProceed?`
      )
      if (!proceed) return

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i]
        console.log(`Printing invoice ${i + 1}/${invoices.length}: ${inv.orderId}`)
        await printInvoice(inv.url, inv.filename)
        // Small delay between prints
        await sleep(1000)
      }
      alert('All invoices processed!')
    })

    function printInvoice (url, filename) {
      return new Promise((resolve) => {
        // Create a hidden iframe to load the invoice
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        iframe.src = url

        iframe.onload = function () {
          try {
            // Give the page a moment to render
            setTimeout(() => {
              iframe.contentWindow.print()
              // Wait for print dialog to be handled, then clean up
              setTimeout(() => {
                document.body.removeChild(iframe)
                resolve()
              }, 2000)
            }, 1500)
          } catch (e) {
            console.error('Print failed for', url, e)
            // Fallback: open in new tab
            window.open(url, '_blank')
            document.body.removeChild(iframe)
            resolve()
          }
        }

        document.body.appendChild(iframe)
      })
    }

    function sleep (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
  })
})()
