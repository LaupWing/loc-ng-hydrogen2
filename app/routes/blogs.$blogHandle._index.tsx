import { defer, type LoaderFunctionArgs } from "@netlify/remix-runtime"
import { Link, useLoaderData, type MetaFunction } from "@remix-run/react"
import { Image, getPaginationVariables } from "@shopify/hydrogen"
import type { ArticleItemFragment } from "storefrontapi.generated"
import { PaginatedResourceSection } from "~/components/PaginatedResourceSection"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    return [{ title: `Hydrogen | ${data?.blog.title ?? ""} blog` }]
}

export async function loader(args: LoaderFunctionArgs) {
    // Start fetching non-critical data without blocking time to first byte
    const deferredData = loadDeferredData(args)

    // Await the critical data required to render initial state of the page
    const criticalData = await loadCriticalData(args)

    return defer({ ...deferredData, ...criticalData })
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
    context,
    request,
    params,
}: LoaderFunctionArgs) {
    const paginationVariables = getPaginationVariables(request, {
        pageBy: 4,
    })

    if (!params.blogHandle) {
        throw new Response(`blog not found`, { status: 404 })
    }

    const [{ blog }] = await Promise.all([
        context.storefront.query(BLOGS_QUERY, {
            variables: {
                blogHandle: params.blogHandle,
                ...paginationVariables,
            },
        }),
        // Add other queries here, so that they are loaded in parallel
    ])

    if (!blog?.articles) {
        throw new Response("Not found", { status: 404 })
    }

    return { blog }
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({ context }: LoaderFunctionArgs) {
    return {}
}

export default function Blog() {
    const { blog } = useLoaderData<typeof loader>()
    const { articles } = blog

    return (
        <div className="bg-white md:pt-4 pb-16">
            <div className="custom-container flex items-start">
                <h2 className="text-neutral-800 mb-10 text-3xl md:text-5xl font-bold">
                    All Blogs
                    <div className="w-3/4 h-1 bg-yellow-400 mt-2 rounded-full" />
                </h2>
            </div>
            <div className="mx-auto mb-10 custom-container md:grid-cols-3 gap-10 grid">
                {articles.nodes.map((article: ArticleItemFragment) => (
                    <ArticleItem article={article} key={article.id} />
                ))}
                {/* <PaginatedResourceSection connection={articles}>
                {({ node: article, index }) => (
                    <ArticleItem
                        article={article}
                        key={article.id}
                        loading={index < 2 ? "eager" : "lazy"}
                    />
                )}
            </PaginatedResourceSection> */}
            </div>
        </div>
    )
}

function ArticleItem({
    article,
    loading,
}: {
    article: ArticleItemFragment
    loading?: HTMLImageElement["loading"]
}) {
    const publishedAt = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(new Date(article.publishedAt!))
    return (
        <div className="blog-article" key={article.id}>
            <Link
                className="grid gap-2"
                to={`/blogs/${article.blog.handle}/${article.handle}`}
            >
                {article.image && (
                    <div className="rounded-xl overflow-hidden">
                        <Image
                            alt={article.image.altText || article.title}
                            aspectRatio="3/2"
                            className="w-full h-full object-cover"
                            data={article.image}
                            loading={loading}
                            sizes="(min-width: 768px) 50vw, 100vw"
                        />
                    </div>
                )}
                <small>{publishedAt}</small>
                <h3 className="text-2xl font-bold">{article.title}</h3>
                <div
                    className="line-clamp-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: article.contentHtml! }}
                ></div>
            </Link>
        </div>
    )
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOGS_QUERY = `#graphql
    query Blog(
        $language: LanguageCode
        $blogHandle: String!
        $first: Int
        $last: Int
        $startCursor: String
        $endCursor: String
    ) @inContext(language: $language) {
        blog(handle: $blogHandle) {
        title
        seo {
            title
            description
        }
        articles(
            first: $first,
            last: $last,
            before: $startCursor,
            after: $endCursor
        ) {
            nodes {
                ...ArticleItem
                }
                pageInfo {
                    hasPreviousPage
                    hasNextPage
                    hasNextPage
                    endCursor
                    startCursor
                }
            }
        }
    }
    fragment ArticleItem on Article {
        author: authorV2 {
            name
        }
            contentHtml
            handle
            id
            image {
            id
            altText
            url
            width
            height
        }
        publishedAt
        title
        blog {
            handle
        }
    }
` as const
