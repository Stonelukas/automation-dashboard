import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward the request to the backend server
    const response = await fetch('http://localhost:8080/api/browse-folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error proxying browse-folders request:', error)
    return NextResponse.json(
      { 
        success: false, 
        data: { 
          error: error instanceof Error ? error.message : 'Unknown error occurred' 
        } 
      },
      { status: 500 }
    )
  }
}
